import { type Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { ERR, OK } from "@/utils/http";
import { logError } from "@/utils/logger";
import { issueSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/utils/session";

/**
 * Turnstile challenge exchange for the web dashboard.
 *
 * The browser solves the widget, POSTs the resulting token here, and receives an
 * HttpOnly session cookie that the API middleware accepts. This is what keeps the
 * API key out of page JS.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare's documented always-passes test secret: siteverify returns
 * `success: true` for ANY token when this is the secret.
 *
 * It is therefore only safe on a local, non-HTTPS origin. Falling back to it on
 * a real deploy would turn a missing TURNSTILE_SECRET_KEY into a total gate
 * bypass — anyone could POST junk to /auth/verify and be handed a valid session
 * cookie for the whole API. `isLocalOrigin` below is what keeps that impossible;
 * everywhere else a missing secret fails closed with a 503, matching how the
 * API-key middleware already treats a missing API_KEY.
 */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

/**
 * True only for loopback origins over plain HTTP, i.e. `bun run dev`.
 *
 * Deliberately does not trust the Host header alone: a request arriving over
 * HTTPS is by definition not local dev, and Cloudflare terminates TLS for every
 * real deploy, so production can never satisfy both conditions.
 */
function isLocalOrigin(requestUrl: string): boolean {
	const url = new URL(requestUrl);
	if (url.protocol !== "http:") return false;
	return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

interface SiteverifyResponse {
	success: boolean;
	// Note the hyphen: this is the wire format, not a typo.
	"error-codes"?: string[];
}

const authRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Pull the challenge token from either a JSON body or a form post. Returns
 * undefined for absent/unparseable bodies; the caller turns that into a 400.
 * Extracted from the handler to keep its branching manageable.
 */
async function readToken(c: Context): Promise<string | undefined> {
	const contentType = c.req.header("Content-Type") || "";
	try {
		if (contentType.includes("application/json")) {
			const body = await c.req.json<{ token?: string; "cf-turnstile-response"?: string }>();
			return body.token || body["cf-turnstile-response"];
		}
		// The widget's native form field name.
		const form = await c.req.parseBody();
		const raw = form["cf-turnstile-response"] ?? form.token;
		return typeof raw === "string" ? raw : undefined;
	} catch {
		return undefined;
	}
}

/** Ask Cloudflare whether the token is genuine. */
async function siteverify(
	secret: string,
	token: string,
	remoteip: string | undefined,
): Promise<SiteverifyResponse> {
	const res = await fetch(SITEVERIFY_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret, response: token, remoteip }),
	});
	return res.json<SiteverifyResponse>();
}

/**
 * Map a failed siteverify outcome to a response, or null when it succeeded.
 *
 * A bad secret is OUR fault, not evidence the visitor is a bot, so it is logged
 * and reported as a misconfiguration rather than folded into a generic 403 where
 * it would be indistinguishable from ordinary abuse.
 */
function describeRejection(
	outcome: SiteverifyResponse,
): { body: ReturnType<typeof ERR>; status: 403 | 503 } | null {
	if (outcome.success) return null;

	const codes = outcome["error-codes"] ?? [];
	if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
		logError(`Turnstile secret rejected by Cloudflare: ${codes.join(", ")}`);
		return {
			body: ERR("Verification is misconfigured on the server.", "ServerMisconfigured"),
			status: 503,
		};
	}
	return { body: ERR("Verification failed. Please try again.", "VerificationFailed"), status: 403 };
}

authRoutes.post("/auth/verify", async (c) => {
	const sessionSecret = c.env.SESSION_SECRET;
	if (!sessionSecret) {
		// Without a signing secret we cannot mint a trustworthy cookie. Say so
		// plainly rather than issuing something unverifiable.
		return c.json(ERR("Session signing is not configured.", "ServerMisconfigured"), 503);
	}

	const token = await readToken(c);
	if (!token) {
		return c.json(ERR("Missing Turnstile token.", "BadRequest"), 400);
	}

	// Throttle before spending a siteverify round trip. A Turnstile token is
	// single-use, but nothing stops a solver farm from redeeming many of them, so
	// cap how fast one client can mint sessions. Keyed on the Cloudflare-supplied
	// client IP, which the caller cannot forge.
	const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
	if (c.env.AUTH_RATE_LIMITER) {
		const { success: allowed } = await c.env.AUTH_RATE_LIMITER.limit({ key: `auth:${clientIp}` });
		if (!allowed) {
			return c.json(ERR("Too many verification attempts. Try again shortly.", "RateLimited"), 429);
		}
	}

	// Fail closed on a real origin: without a verification secret we cannot tell a
	// human from a bot, and the test secret would accept anything.
	const turnstileSecret = c.env.TURNSTILE_SECRET_KEY;
	if (!turnstileSecret && !isLocalOrigin(c.req.url)) {
		logError("TURNSTILE_SECRET_KEY is not set; refusing to issue sessions", new Error("unset"));
		return c.json(ERR("Bot verification is not configured.", "ServerMisconfigured"), 503);
	}

	let outcome: SiteverifyResponse;
	try {
		outcome = await siteverify(
			turnstileSecret || TEST_SECRET,
			token,
			// Cloudflare sets this header itself; a client cannot forge it.
			c.req.header("CF-Connecting-IP") || undefined,
		);
	} catch (error) {
		// Network/parse failure talking to Cloudflare. Fail closed: no cookie.
		logError("Turnstile siteverify request failed", error as Error);
		return c.json(ERR("Could not reach the verification service.", "VerificationUnavailable"), 502);
	}

	const rejection = describeRejection(outcome);
	if (rejection) return c.json(rejection.body, rejection.status);

	const nowSeconds = Math.floor(Date.now() / 1000);
	const session = await issueSession(sessionSecret, nowSeconds);

	setCookie(c, SESSION_COOKIE, session, {
		httpOnly: true, // page JS never needs to read it
		// Secure everywhere except local dev, where it would make the cookie
		// undeliverable over plain-HTTP localhost. Keying this off the ORIGIN rather
		// than the request protocol matters: if the zone also answers on plain HTTP,
		// protocol-keying would hand real visitors a sniffable, non-Secure cookie.
		secure: !isLocalOrigin(c.req.url),
		// Lax is sufficient: the dashboard's fetch() calls are same-origin.
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});

	return c.json(OK({ verified: true, expiresIn: SESSION_TTL_SECONDS }));
});

export default authRoutes;
