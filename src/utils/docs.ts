import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { DOMAINS_SET } from "@/config/domains";

export function setupDocumentation(app: OpenAPIHono<{ Bindings: CloudflareBindings }>) {
	// Advertise the API key so Swagger/Scalar render an Authorize box and the
	// generated examples include the header. Registered as two schemes because
	// the middleware accepts either header.
	app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
		type: "http",
		scheme: "bearer",
		description: "Send your API key as `Authorization: Bearer <key>`.",
	});
	app.openAPIRegistry.registerComponent("securitySchemes", "apiKeyAuth", {
		type: "apiKey",
		in: "header",
		name: "X-API-Key",
		description: "Alternative to the bearer header: `X-API-Key: <key>`.",
	});

	// OpenAPI Documentation.
	// The config is a function so the server URL is derived from the incoming
	// request instead of being hardcoded — the docs then show the correct base
	// URL on any host (custom domain, workers.dev, or localhost during dev).
	app.doc("/openapi.json", (c) => ({
		openapi: "3.0.0",
		// Applies to every operation. Either scheme satisfies it (the middleware
		// accepts both headers). Typed explicitly because TypeScript otherwise
		// infers a union of two differently-shaped object literals, which does
		// not match OpenAPI's SecurityRequirementObject index signature.
		security: [{ bearerAuth: [] }, { apiKeyAuth: [] }] as Record<string, string[]>[],
		info: {
			version: "1.0.0",
			title: "Temp Mail API",
			description: `
# Temporary Email Service API

A simple and fast temporary email service that allows you to receive emails without registration.

## Authentication
All data endpoints require an API key, sent as either header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
\`\`\`

Click **Authorize** above to add your key to the "Try it" requests.

- \`401 Unauthorized\` — no key was sent
- \`403 Forbidden\` — a key was sent but it is not valid

Public endpoints that need no key: \`/health\`, \`/domains\`, the docs, and the web dashboard.
The dashboard itself authenticates with a Cloudflare Turnstile challenge instead of a key, so
the key is never exposed in browser code.

## Features
- Receive emails on temporary addresses
- Multiple supported domains
- Real-time email retrieval
- No registration required
- Automatic cleanup

## Response Format
- **Success responses** include \`success: true\` and a \`result\` field
- **Error responses** include \`success: false\` and an \`error\` object
- **Validation errors** include \`success: false\` and detailed error information

## Supported Domains
This API currently supports the following email domains:
${`\n${Array.from(DOMAINS_SET)
	.map((domain) => `- ${domain}`)
	.join("\n")}`}

**Repository**: [github.com/kadangkesel/ligature-temp-mail](https://github.com/kadangkesel/ligature-temp-mail)
**Issues**: [Report bugs or request features](https://github.com/kadangkesel/ligature-temp-mail/issues)
`,
			contact: {
				name: "API Support",
				url: "https://github.com/kadangkesel/ligature-temp-mail",
			},
			license: {
				name: "MIT",
				url: "https://github.com/kadangkesel/ligature-temp-mail/blob/main/LICENSE",
			},
		},
		servers: [
			{
				url: new URL(c.req.url).origin,
				description: "Current server",
			},
		],
		tags: [
			{
				name: "Emails",
				description: "Operations for managing emails by email address",
			},
			{
				name: "Inbox",
				description: "Operations for individual email messages",
			},
			{
				name: "Domains",
				description: "Get information about supported email domains",
			},
		],
		"x-repository": "https://github.com/kadangkesel/ligature-temp-mail",
		"x-issues": "https://github.com/kadangkesel/ligature-temp-mail/issues",
	}));

	// Swagger UI - Traditional documentation
	app.get("/swagger", swaggerUI({ url: "/openapi.json" }));

	// Scalar - Modern documentation
	app.get(
		"/docs",
		Scalar({
			url: "/openapi.json",
			theme: "purple",
		}),
	);
}
