import type { MiddlewareHandler } from "hono";

/**
 * Baseline response headers.
 *
 * The dashboard renders sender-controlled HTML, so defence in depth matters here:
 * even with the sanitizer in utils/mail.ts, a CSP limits what a missed payload
 * could reach, and nosniff stops a mistyped attachment being run as script.
 *
 * The docs routes are exempted from CSP because Scalar/Swagger UI load their
 * bundles from a CDN and use inline styles; blocking those would break the docs
 * page without protecting anything sensitive (it renders no user content).
 */
const CSP = [
	"default-src 'self'",
	// Turnstile's api.js must be loadable, and it propagates the policy to the
	// resources it pulls in. `unsafe-inline` is still required because the
	// dashboard ships as one inline <script> block; sender HTML is not what this
	// protects — that is rendered in a sandboxed iframe that forbids script
	// outright. Listing the host in script-src (not only script-src-elem) matters
	// because browsers that ignore the latter fall back to the former.
	"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
	"script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com",
	"style-src 'self' 'unsafe-inline'",
	// Remote images are allowed so legitimate HTML mail renders; data: covers
	// inline/cid images after rewriting.
	"img-src 'self' data: https:",
	"font-src 'self' data:",
	// 'self' covers the dashboard's own fetch() calls and Turnstile pre-clearance.
	"connect-src 'self'",
	// Turnstile renders its widget in a frame; the message iframe uses srcdoc.
	"frame-src 'self' https://challenges.cloudflare.com",
	"form-action 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
].join("; ");

/**
 * Exact docs paths, as registered in utils/docs.ts. Matched by equality rather
 * than prefix so a future route like /docsomething cannot silently inherit the
 * CSP exemption.
 */
const DOCS_PATHS = new Set(["/docs", "/swagger", "/openapi.json"]);

const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
	await next();

	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-Frame-Options", "DENY");
	c.header("Referrer-Policy", "no-referrer");
	c.header("Cross-Origin-Opener-Policy", "same-origin");
	c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");

	// Only meaningful over TLS, and setting it on plain HTTP is ignored anyway.
	if (new URL(c.req.url).protocol === "https:") {
		c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}

	const path = new URL(c.req.url).pathname;
	if (!DOCS_PATHS.has(path)) {
		c.header("Content-Security-Policy", CSP);
	}
};

export default securityHeadersMiddleware;
