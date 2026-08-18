import { OpenAPIHono } from "@hono/zod-openapi";
import attachmentRoutes from "@/routes/attachmentRoutes";
import emailRoutes from "@/routes/emailRoutes";
import { setupDocumentation } from "@/utils/docs";
import { logError } from "@/utils/logger";
import apiKeyMiddleware from "./middlewares/apiKey";
import corsMiddleware from "./middlewares/cors";
import securityHeadersMiddleware from "./middlewares/securityHeaders";
import authRoutes from "./routes/authRoutes";
import compatRoutes from "./routes/compatRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import faviconRoutes from "./routes/faviconRoutes";
import healthRoutes from "./routes/healthRoutes";
import { ERR } from "./utils/http";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

// --- Middlewares ---
app.use(corsMiddleware);
app.use(securityHeadersMiddleware);

// --- Error handling ---
app.onError((err, c) => {
	// Log the real error server-side, but return a generic message: raw errors
	// leaked internals (e.g. a D1 failure echoed the SQL statement back to the
	// caller). Validation errors raised deliberately by handlers keep their own
	// explicit responses, so this only covers genuine unhandled faults.
	logError(`Unhandled error: ${err.message}`, err);
	return c.json(ERR("An internal error occurred.", "InternalServerError"), 500);
});

/**
 * --- Authentication ---
 * Guard the data-bearing API surface against bot abuse. Registered before the
 * route handlers below so it runs first.
 *
 * Deliberately left open: "/" (dashboard), the favicons, "/health", "/domains",
 * and the docs endpoints. Note that "/domains" lives inside emailRoutes but sits
 * outside every guarded prefix, so it stays public without a carve-out.
 *
 * Accepted credentials are an API key or the dashboard's Turnstile session
 * cookie — see middlewares/apiKey.ts for why both exist.
 */
for (const prefix of ["/emails/*", "/inbox/*", "/attachments/*", "/api/*"]) {
	app.use(prefix, apiKeyMiddleware);
}

// --- Routes ---
// Turnstile challenge exchange (must stay public: it is how a browser authenticates)
app.route("/", authRoutes);
// Email Routes
app.route("/", emailRoutes);
// Attachment Routes
app.route("/", attachmentRoutes);
// Health Check
app.route("/", healthRoutes);
// Legacy TempMail API compatibility
app.route("/", compatRoutes);
// Favicon / touch icon (static, no bindings needed)
app.route("/", faviconRoutes);
// Dashboard homepage (must be before docs so it owns "/")
app.route("/", dashboardRoutes);

// --- OpenAPI Documentation ---
setupDocumentation(app);

export default app;
