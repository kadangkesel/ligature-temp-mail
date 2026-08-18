/**
 * Response-header construction for attachment downloads.
 *
 * Both the filename and the content type come from whoever sent the email, so
 * neither can be echoed back as-is. Kept in its own module so the rules are
 * unit-testable without standing up a Worker and its D1/R2 bindings.
 */

/**
 * Content types that must never be echoed back verbatim, because a browser would
 * execute them in this origin's context. Everything risky collapses to a generic
 * binary type, which forces a download instead.
 */
const UNSAFE_CONTENT_TYPES =
	/^(text\/html|text\/xml|application\/xhtml|image\/svg|application\/xml)/i;

/** Only a conservative token set; anything else is not a valid media type anyway. */
const VALID_CONTENT_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export function safeContentType(raw: string | null | undefined): string {
	const type = (raw || "").split(";")[0].trim();
	if (!type || !VALID_CONTENT_TYPE.test(type)) return "application/octet-stream";
	if (UNSAFE_CONTENT_TYPES.test(type)) return "application/octet-stream";
	return type;
}

/**
 * Builds an RFC 6266 Content-Disposition. The ASCII `filename` is stripped to a
 * safe subset for old clients; `filename*` carries the real (percent-encoded)
 * name and takes precedence in every modern browser.
 */
export function contentDisposition(raw: string | null | undefined): string {
	// Strip control characters by code point (not a regex class): a CR/LF in a
	// sender-supplied filename could otherwise split or corrupt the response headers.
	const original = Array.from(raw || "")
		.filter((ch) => {
			const code = ch.charCodeAt(0);
			return code > 0x1f && code !== 0x7f;
		})
		.join("");
	const fallback = original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "attachment";
	const encoded = encodeURIComponent(original).slice(0, 300);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
