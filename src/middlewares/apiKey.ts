import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { ERR } from "@/utils/http";
import { SESSION_COOKIE, verifySession } from "@/utils/session";

/**
 * Authentication for the API surface.
 *
 * Two accepted credentials, because there are two distinct kinds of caller:
 *   1. Machine clients send the shared key (`Authorization: Bearer` or `X-API-Key`).
 *   2. The web dashboard sends the session cookie it earned by solving Turnstile.
 *      It cannot use the API key — page JS is public, so embedding the key there
 *      would hand it to every visitor.
 */

const encoder = new TextEncoder();

/**
 * Constant-time secret comparison.
 *
 * Two hazards are handled here:
 *
 * 1. `crypto.subtle.timingSafeEqual` THROWS a TypeError when the two buffers
 *    differ in length (verified against workerd). Comparing raw inputs would
 *    turn any wrong-length key into a 500, and the difference between "500" and
 *    "403" would leak the real key's length.
 * 2. That function is a workerd extension, absent from other Web Crypto
 *    implementations (Bun, Node, browsers), so it cannot be called
 *    unconditionally without breaking every non-Cloudflare runtime.
 *
 * Hashing both sides to a fixed 32 bytes removes the length dependency, which
 * fixes (1) and lets the fallback for (2) be a fixed-length XOR accumulation
 * that always inspects every byte.
 */
async function secretsMatch(a: string, b: string): Promise<boolean> {
	const [ha, hb] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(a)),
		crypto.subtle.digest("SHA-256", encoder.encode(b)),
	]);

	const subtle = crypto.subtle as SubtleCrypto & {
		timingSafeEqual?: (x: ArrayBuffer, y: ArrayBuffer) => boolean;
	};
	if (typeof subtle.timingSafeEqual === "function") {
		return subtle.timingSafeEqual(ha, hb);
	}

	// Both digests are SHA-256, so the lengths always match and no early exit occurs.
	const xs = new Uint8Array(ha);
	const ys = new Uint8Array(hb);
	let diff = 0;
	for (let i = 0; i < xs.length; i++) diff |= xs[i] ^ ys[i];
	return diff === 0;
}

/** Pull a presented key out of either supported header. */
function readPresentedKey(c: Context): string | undefined {
	const auth = c.req.header("Authorization");
	if (auth) {
		// Match the scheme case-insensitively, per RFC 7235.
		const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
		if (match) return match[1].trim();
	}
	return c.req.header("X-API-Key")?.trim() || undefined;
}

const apiKeyMiddleware = async (c: Context<{ Bindings: CloudflareBindings }>, next: Next) => {
	const configuredKey = c.env.API_KEY;
	const sessionSecret = c.env.SESSION_SECRET;

	// The dashboard's cookie is checked first: it is the common case for browser
	// traffic and costs one HMAC.
	const cookie = getCookie(c, SESSION_COOKIE);
	if (cookie && sessionSecret) {
		const nowSeconds = Math.floor(Date.now() / 1000);
		if (await verifySession(cookie, sessionSecret, nowSeconds)) return next();
	}

	const presented = readPresentedKey(c);

	if (!presented) {
		// No credential at all. 401 tells the client to authenticate.
		c.header("WWW-Authenticate", 'Bearer realm="api"');
		return c.json(
			ERR(
				"Authentication required. Send your key as `Authorization: Bearer <key>`.",
				"Unauthorized",
			),
			401,
		);
	}

	// Fail closed. An unset API_KEY means a misconfigured deploy, and treating
	// that as "allow everything" would silently reopen the API to bots.
	if (!configuredKey) {
		return c.json(ERR("Server authentication is not configured.", "ServerMisconfigured"), 503);
	}

	if (!(await secretsMatch(configuredKey, presented))) {
		// A credential was supplied but is wrong: 403, not 401, so clients do not
		// loop retrying the same bad key.
		return c.json(ERR("The provided API key is not valid.", "Forbidden"), 403);
	}

	return next();
};

export default apiKeyMiddleware;
