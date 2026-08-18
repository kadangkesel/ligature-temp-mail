import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { DOMAINS_SET } from "@/config/domains";

export function setupDocumentation(app: OpenAPIHono<{ Bindings: CloudflareBindings }>) {
	// OpenAPI Documentation.
	// The config is a function so the server URL is derived from the incoming
	// request instead of being hardcoded — the docs then show the correct base
	// URL on any host (custom domain, workers.dev, or localhost during dev).
	app.doc("/openapi.json", (c) => ({
		openapi: "3.0.0",
		info: {
			version: "1.0.0",
			title: "Temp Mail API",
			description: `
# Temporary Email Service API

A simple and fast temporary email service that allows you to receive emails without registration.

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
