import { Hono } from "hono";

const faviconRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/*
 * Favicons are embedded as base64 rather than served from ./public because this
 * Worker has no static-assets binding configured (see wrangler.jsonc) — adding
 * one would mean a build step for ~1.5KB of icon. The mark matches the header
 * logo: a #00FF7F envelope on #000000.
 *
 * Regenerate with the supersampled rasteriser if the palette changes; the ICO
 * bundles 16/32/48px PNGs so browsers pick their own size instead of downscaling.
 */
const ICO_B64 =
	"AAABAAMAEBAAAAEAIACkAAAANgAAACAgAAABACAA1AAAANoAAAAwMAAAAQAgACUBAACuAQAAiVBORw0KGgoAAAANSUhEUgAA" +
	"ABAAAAAQCAYAAAAf8/9hAAAAa0lEQVR42mNgYGD4TyEengYYSPxncFBAxSAxvAYUWPxnUBCAsAU4IPz7+RAMYoPEQHIgNSA+" +
	"hgH74/8z/K//zzDfH2EQMgaJgeRAakBqcRoAwyDFMOfDNMIwUQbgw4PUAGxRhwujRumIzwsAzXNT9K/d58MAAAAASUVORK5C" +
	"YIKJUE5HDQoaCgAAAA1JSERSAAAAIAAAACAIBgAAAHN6evQAAACbSURBVHjaY2BgYPg/wHjUAaMOGHXAqAOIVGgg8Z+hwYE4" +
	"DFJLtgMUBHArBsnN9//P8L8eOwbJEdJP0AEgH9zPh9ACHMQ5BJ/FIDOQzSTKATCD35cTdgghi0FmwMwj2QHEOoSQxRQ7gJh4" +
	"JpQ+qOYAZIeAUjsIE7KYJg4gB486YNQBQ8MBDgrEVzqkYpDZo+2BUQeMOmDUAYPNAQAdkk/QSCc7lAAAAABJRU5ErkJggolQ" +
	"TkcNChoKAAAADUlIRFIAAAAwAAAAMAgGAAAAVwL5hwAAAOxJREFUeNrt170NwjAQhuErKTNCSkpGyAawAXSUlJRkE0ZhBEZg" +
	"BEYw+ooIix/F5zgQxFucFCU5+3viOFLMzMKPFwAAAAAAAAAAAID/BWwWwdomr9Q7iRVQkMsuWDikle4tE74HcFoHa2of5Lx9" +
	"H1zXPME1tzJkA7qJNchq7p847vc8CM0V9w8G5C69QntX8NWrWAwwzjvcv4eKA2KIvibVzB9aPepN2fyjAbq67tMhXXD1pI4/" +
	"OuARUlfPY+mcN/jHAXEdl/dNrOMhY30FULIAAAAAAACALEDur2Lp4qceAAAAAAAAAAAAwCTrBmNh0w5BDmsHAAAAAElFTkSu" +
	"QmCC";

const APPLE_TOUCH_B64 =
	"iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAADFElEQVR42u3cMUrEUBCA4VdaegRLS0tLO0vtLLWz1M5Sb+AR" +
	"PIJH8AgewSN4hMggC4uwwqKbzcx8xQ8LgpvkfWiSl7wxxpikQjkIAloCWgJaAlpAS0BLQEtAS0ALaAloCWgJaAloAS0BLQEt" +
	"AS0BLaAloCWgJaAloAW0BLQEtAS0BLSAloCWgJaAloAW0BLQEtAS0AJaAloCWgJaAlpAS0BLQEtAS0ALaAloCWgJaAnoaZwd" +
	"TePtehrTY69in2PfgS4M+/WqPuTYx16Qm59yHB1O4+WiHuTYp9g3pxxggwx0LdhPZ9P4fMiDOLY1thlkoDd2eLB82CvIsa3G" +
	"bA+g4+Lk/XYaNyf5YH/cLQdybEs2yDHmMfbzXaDOBHp9UDLBXg3KPmFXOGZlQf8cpGx/beaEnQ1yjOWmY1QedObzwRi0XU7S" +
	"xO/OeHr223VHG9CZYf/37GO2Wb1tLqDbgV6Hne2e6l9hZ4O8une/zZ2gtqAzTxZsO0lTff+AbjLwnSADXexf8/P597/mKD53" +
	"OpUCuvDFU+eLXaCL3t7qfDsS6OIzad0mjIAGu9TMJ9CeRiv1NCHQYJd6LBZoD8KXenEBaK8qlXq1DGiwS70jCbTX/UstzwC0" +
	"BVlKLaAD9B5hXx4vH3JsY6aVoIBewAupS5yk2ff7jUAnBb002FkhA71g2Pen807SxHfFd2aGDHSS1Yp2CTvDYjdAF1sUcRew" +
	"K0IGuuFCiVVXQgW6GewOkIEuAvu3AYyfdYEMdKHi7kRMfsR5cRSfK9yxALopaAEtoIEW0EALaKAFNNACWkADLaCBFtBAC2iD" +
	"CjTQAhpoAQ20gAZaQAtooAU00AIaaAENtIAW0EALaKAFNNACGmgBLaCBFtBAC2igBTTQAlpAAy2ggRbQQAtooAW0gM4BWpov" +
	"B0FAS0BLQEtAC2gJaAloCWgJaAEtAS0BLQEtAS2gJaAloCWgJaAFtAS0BLQEtAS0gJaAloCWgJaAFtAS0BLQEtAS0AJaAloC" +
	"WgJaQEtAS0BLQEtAC2gJaAloCWgJaAEtAS0BLQEtbe4LMGUQar+rmfoAAAAASUVORK5CYII=";

// Vector version for browsers that prefer it (stays crisp at any size). Geometry
// mirrors the raster mark above: body 3..29 x 8..24 on a 32x32 grid, flap apex at
// y=14.2. Kept as a literal string so it needs no escaping at the call site.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<rect width="32" height="32" fill="#000000"/>
<rect x="4.6" y="9.6" width="22.8" height="12.8" fill="#00FF7F"/>
<path d="M3 8 L16 14.2 L29 8" fill="none" stroke="#000000" stroke-width="3.4" stroke-linejoin="round"/>
</svg>`;

// Long-lived cache: the icon is immutable for a given deploy, and browsers
// re-request favicons aggressively otherwise.
const CACHE_CONTROL = "public, max-age=604800, immutable";

function decode(b64: string): Uint8Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

function serve(b64: string, contentType: string) {
	const body = decode(b64);
	return new Response(body, {
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(body.byteLength),
			"Cache-Control": CACHE_CONTROL,
		},
	});
}

faviconRoutes.get("/favicon.ico", () => serve(ICO_B64, "image/x-icon"));
faviconRoutes.get("/apple-touch-icon.png", () => serve(APPLE_TOUCH_B64, "image/png"));
faviconRoutes.get("/favicon.svg", () => {
	return new Response(SVG, {
		headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": CACHE_CONTROL },
	});
});

export default faviconRoutes;
