import { convert } from "html-to-text";
import { HTML_PROCESSING } from "@/config/constants";

/**
 * Safely get the domain from an email address
 */
export function getDomain(email: string): string {
	const parts = email.split("@");
	return (parts.length > 1 ? parts.pop() : email)?.trim() ?? email;
}

/** Escape text for insertion into HTML body/attribute context. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Tags kept when sanitizing sender HTML. Everything else is dropped, including
 * its attributes. `script`/`style`/`iframe`/`object`/`embed`/`base`/`meta`/`link`
 * are absent by design, so they cannot execute, exfiltrate, or retarget links.
 */
const ALLOWED_TAGS = new Set([
	"a",
	"b",
	"blockquote",
	"br",
	"caption",
	"code",
	"col",
	"colgroup",
	"dd",
	"div",
	"dl",
	"dt",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"li",
	"ol",
	"p",
	"pre",
	"s",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
]);

/** Attributes kept per tag. No `style`, and no `on*` can ever survive an allowlist. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
	a: new Set(["href", "title"]),
	img: new Set(["src", "alt", "title", "width", "height"]),
	td: new Set(["colspan", "rowspan"]),
	th: new Set(["colspan", "rowspan"]),
};

/** Tags whose entire contents are discarded, not just the tag itself. */
const VOID_CONTENT_TAGS = new Set(["script", "style", "title", "textarea", "noscript"]);

const SELF_CLOSING = new Set(["br", "hr", "img", "col"]);

/**
 * Only http/https/mailto/cid survive. Checked after collapsing whitespace and
 * HTML entities, because `java&#9;script:` and `java\tscript:` both normalize to
 * `javascript:` in a browser's URL parser.
 */
/**
 * Drop every character at or below U+0020 (ASCII controls plus space).
 *
 * Done by code point rather than a regex character class: control characters in a
 * regex are invisible in source and easy to corrupt, which is what Biome's
 * `noControlCharactersInRegex` rule exists to prevent.
 */
function stripControlAndSpace(input: string): string {
	let out = "";
	for (const ch of input) {
		if (ch.charCodeAt(0) > 0x20) out += ch;
	}
	return out;
}

function safeUrl(raw: string): string | null {
	// Controls and spaces are stripped because a browser ignores them inside a
	// scheme: `java\tscript:` and `java&#9;script:` both resolve to `javascript:`.
	const decoded = stripControlAndSpace(
		raw
			.replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(Number(d)))
			.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16))),
	).toLowerCase();
	if (/^(https?:|mailto:|cid:)/.test(decoded)) return raw.trim();
	// Protocol-relative and rooted/relative paths carry no scheme, so they are safe.
	if (/^(\/|#|\.)/.test(decoded)) return raw.trim();
	return null;
}

/**
 * Parser-based HTML sanitizer (allowlist).
 *
 * Replaces an earlier regex blocklist that was bypassable in several ways —
 * unquoted handlers (`<img src=x onerror=alert(1)>`) passed untouched, and its
 * single-pass `javascript:` strip could REASSEMBLE a live scheme from a split
 * payload (`javajavascript:script:` -> `javascript:`). An allowlist inverts the
 * default: anything not explicitly permitted is dropped, so an unanticipated
 * payload fails safe instead of slipping through.
 */
/**
 * Index just past a comment / doctype / processing instruction starting at `lt`,
 * or -1 if `lt` does not begin one. These are skipped wholesale rather than
 * emitted, since a comment can hide markup that some parsers resurrect.
 */
function skipNonElement(html: string, lt: number): number {
	if (html.startsWith("<!--", lt)) {
		const end = html.indexOf("-->", lt + 4);
		return end === -1 ? html.length : end + 3;
	}
	if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
		const end = html.indexOf(">", lt);
		return end === -1 ? html.length : end + 1;
	}
	return -1;
}

/** Index just past `</tag>`, used to discard an element together with its contents. */
function skipElementContents(html: string, tag: string, gt: number): number {
	const close = html.toLowerCase().indexOf(`</${tag}`, gt);
	if (close === -1) return html.length;
	const closeEnd = html.indexOf(">", close);
	return closeEnd === -1 ? html.length : closeEnd + 1;
}

/**
 * The markup to emit for one parsed tag. A tag outside the allowlist yields the
 * empty string, which drops the tag but keeps its inner text.
 */
function renderTag(tag: string, rawTag: string, isClosing: boolean): string {
	if (!ALLOWED_TAGS.has(tag)) return "";
	if (isClosing) return SELF_CLOSING.has(tag) ? "" : `</${tag}>`;
	return `<${tag}${sanitizeAttributes(rawTag, tag)}${SELF_CLOSING.has(tag) ? " /" : ""}>`;
}

function sanitizeHtml(html: string): string {
	let out = "";
	let i = 0;

	while (i < html.length) {
		const lt = html.indexOf("<", i);
		if (lt === -1) {
			out += escapeHtml(html.slice(i));
			break;
		}
		out += escapeHtml(html.slice(i, lt));

		const skipped = skipNonElement(html, lt);
		if (skipped !== -1) {
			i = skipped;
			continue;
		}

		const gt = html.indexOf(">", lt);
		if (gt === -1) {
			// Unterminated tag: escape the remainder so nothing can be reinterpreted.
			out += escapeHtml(html.slice(lt));
			break;
		}

		const rawTag = html.slice(lt + 1, gt);
		const isClosing = rawTag.startsWith("/");
		const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(rawTag);
		if (!nameMatch) {
			i = gt + 1;
			continue;
		}
		const tag = nameMatch[1].toLowerCase();

		if (VOID_CONTENT_TAGS.has(tag)) {
			// Drop the element AND its text, so CSS/JS bodies never reach the output.
			i = skipElementContents(html, tag, gt);
			continue;
		}

		out += renderTag(tag, rawTag, isClosing);
		i = gt + 1;
	}

	return out;
}

/** Rebuild only the allowlisted attributes of one tag, re-quoting every value. */
/**
 * One allowlisted attribute, always re-quoted. URL-bearing attributes are dropped
 * entirely unless the value carries a safe scheme, so `href="javascript:..."`
 * disappears rather than being emitted in a mangled form.
 */
function renderAttribute(name: string, value: string): string {
	if (name === "href" || name === "src") {
		const url = safeUrl(value);
		return url ? ` ${name}="${escapeHtml(url)}"` : "";
	}
	return ` ${name}="${escapeHtml(value)}"`;
}

function sanitizeAttributes(rawTag: string, tag: string): string {
	const permitted = ALLOWED_ATTRS[tag];
	if (!permitted) return "";

	let result = "";
	const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
	// Skip the tag name itself.
	attrRe.lastIndex = rawTag.indexOf(tag) + tag.length;

	let m = attrRe.exec(rawTag);
	while (m !== null) {
		const name = m[1].toLowerCase();
		if (permitted.has(name)) {
			result += renderAttribute(name, m[2] ?? m[3] ?? m[4] ?? "");
		}
		m = attrRe.exec(rawTag);
	}

	// Untrusted links must not control our tab or leak the referrer.
	if (tag === "a" && result.includes("href=")) {
		result += ' rel="noopener noreferrer nofollow" target="_blank"';
	}
	return result;
}

/**
 * Convert HTML to plain text with size limits and error handling
 */
function htmlToText(html: string): string | null {
	try {
		// Check size limit and truncate if needed
		const encodedHtml = new TextEncoder().encode(html);
		if (encodedHtml.byteLength > HTML_PROCESSING.MAX_CONVERSION_SIZE) {
			console.warn("HTML content too large for conversion, truncating");
			// Calculate truncate position based on character estimate (UTF-8)
			const truncateRatio = HTML_PROCESSING.MAX_CONVERSION_SIZE / encodedHtml.byteLength;
			html = html.substring(0, Math.floor(html.length * truncateRatio));
		}

		const text = convert(html, {
			wordwrap: HTML_PROCESSING.WORDWRAP_LENGTH,
			selectors: [
				// Remove potentially dangerous content
				{ selector: "script", format: "skip" },
				{ selector: "style", format: "skip" },
				{ selector: "iframe", format: "skip" },
			],
		});

		return text.trim() === "" ? null : text;
	} catch (error) {
		console.error("Failed to convert HTML to text:", error);
		return null;
	}
}

/**
 * Convert plain text to HTML template
 */
function textToHtmlTemplate(text: string): string | null {
	if (text.trim() === "") {
		return null;
	}

	// Must be escaped: a text-only email whose body contains `</pre><script>...`
	// would otherwise break out of the wrapper and execute.
	return `<pre style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(text)}</pre>`;
}

/**
 * Process email content with sanitization and size validation
 */
export function processEmailContent(
	html: string | null,
	text: string | null,
): {
	htmlContent: string | null;
	textContent: string | null;
} {
	// Sanitize HTML content if present
	const sanitizedHtml = html ? sanitizeHtml(html) : null;

	// Both exist - return sanitized HTML and original text
	if (sanitizedHtml && text) {
		return { htmlContent: sanitizedHtml, textContent: text };
	}

	// Only HTML exists - generate text from sanitized HTML
	if (sanitizedHtml && !text) {
		return { htmlContent: sanitizedHtml, textContent: htmlToText(sanitizedHtml) };
	}

	// Only text exists - generate HTML template
	if (!sanitizedHtml && text) {
		return { htmlContent: textToHtmlTemplate(text), textContent: text };
	}

	// Neither exists
	return { htmlContent: null, textContent: null };
}
