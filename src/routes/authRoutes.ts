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
 * Cloudflare's documented always-passes test secret. Used only when no real
 * secret is bound, so `bun run dev` works without provisioning keys. Production
 * sets TURNSTILE_SECRET_KEY and never reaches this.
 */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

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

	let outcome: SiteverifyResponse;
	try {
		outcome = await siteverify(
			c.env.TURNSTILE_SECRET_KEY || TEST_SECRET,
			token,
			// Cloudflare sets this header itself; a client cannot forge it.
			c.req.header("CF-Connecting-IP") || undefined,
		);
	} catch (error) {
		// Network/parse failure talking to Cloudflare. Fail closed: no cookie.
		logError("Turnstile siteverify request failed", error as Error);
		return c.json(ERR("Could not reach the verification service.", "VerificationUnavailable"), 502);
	}

	if (!outcome.success) {
		const codes = outcome["error-codes"] ?? [];
		// `invalid-input-secret` means we are misconfigured, not that the visitor
		// is a bot — log it so it is diagnosable instead of looking like abuse.
		if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
			logError(`Turnstile secret rejected by Cloudflare: ${codes.join(", ")}`);
			return c.json(
				ERR("Verification is misconfigured on the server.", "ServerMisconfigured"),
				503,
			);
		}
		return c.json(ERR("Verification failed. Please try again.", "VerificationFailed"), 403);
	}

	const nowSeconds = Math.floor(Date.now() / 1000);
	const session = await issueSession(sessionSecret, nowSeconds);

	setCookie(c, SESSION_COOKIE, session, {
		httpOnly: true, // page JS never needs to read it
		// Secure would make the cookie undeliverable over plain-HTTP localhost,
		// so it is set for real hosts only.
		secure: new URL(c.req.url).protocol === "https:",
		// Lax is sufficient: the dashboard's fetch() calls are same-origin.
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});

	return c.json(OK({ verified: true, expiresIn: SESSION_TTL_SECONDS }));
});

export default authRoutes;
