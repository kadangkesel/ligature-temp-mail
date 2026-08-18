/**
 * Stateless session tokens for the web dashboard.
 *
 * The page's own JS calls the API from the browser, so it cannot carry the API
 * key (that would expose the key in View Source). Instead the page solves a
 * Turnstile challenge once and receives a short-lived signed cookie.
 *
 * Sessions are stateless HMAC tokens rather than KV records because this Worker
 * has no KV binding (see wrangler.jsonc — there is no `kv_namespaces` entry,
 * despite the generated types advertising one). Consequence to be aware of: a
 * valid token cannot be revoked before it expires. Keep the TTL short.
 */

const encoder = new TextEncoder();

/** 12 hours, in seconds. Long enough to keep an inbox tab usable, short enough to bound replay. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const SESSION_COOKIE = "tm_session";

/** base64url (RFC 4648 §5) without padding — safe inside a cookie value. */
function toBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const byte of bytes) bin += String.fromCharCode(byte);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
	try {
		const padded = value.replace(/-/g, "+").replace(/_/g, "/");
		const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	} catch {
		// Malformed base64 is just an invalid token, not an error worth throwing over.
		return null;
	}
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function sign(payload: string, secret: string): Promise<string> {
	const key = await hmacKey(secret);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return toBase64Url(new Uint8Array(mac));
}

/**
 * Issue a token of the form `<expiry>.<nonce>.<signature>`.
 * The nonce keeps two tokens minted in the same second distinct.
 */
export async function issueSession(secret: string, nowSeconds: number): Promise<string> {
	const exp = nowSeconds + SESSION_TTL_SECONDS;
	const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
	const payload = `${exp}.${nonce}`;
	return `${payload}.${await sign(payload, secret)}`;
}

/**
 * Constant-time MAC comparison.
 *
 * `crypto.subtle.timingSafeEqual` is a workerd extension and is missing from
 * other Web Crypto implementations, so it is feature-detected. Both inputs here
 * are fixed-length SHA-256 MACs, which makes the portable XOR fallback safe:
 * lengths always match, so it never exits early.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;

	const subtle = crypto.subtle as SubtleCrypto & {
		timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean;
	};
	if (typeof subtle.timingSafeEqual === "function") {
		return subtle.timingSafeEqual(a, b);
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/**
 * Verify signature then expiry. Returns false for anything malformed rather
 * than throwing, so a hostile cookie can never produce a 500.
 */
export async function verifySession(
	token: string | undefined,
	secret: string,
	nowSeconds: number,
): Promise<boolean> {
	if (!token || !secret) return false;

	// Exactly three segments; a token with extra dots is not one we minted.
	const parts = token.split(".");
	if (parts.length !== 3) return false;
	const [expRaw, nonce, providedSig] = parts;
	if (!expRaw || !nonce || !providedSig) return false;

	const expectedSig = await sign(`${expRaw}.${nonce}`, secret);
	const provided = fromBase64Url(providedSig);
	const expected = fromBase64Url(expectedSig);
	if (!provided || !expected) return false;

	// Compare the MAC before trusting any field inside the token.
	if (!constantTimeEqual(provided, expected)) return false;

	const exp = Number(expRaw);
	if (!Number.isSafeInteger(exp)) return false;
	return exp > nowSeconds;
}
