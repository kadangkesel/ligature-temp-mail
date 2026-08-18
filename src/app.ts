import { OpenAPIHono } from "@hono/zod-openapi";
import attachmentRoutes from "@/routes/attachmentRoutes";
import emailRoutes from "@/routes/emailRoutes";
import { setupDocumentation } from "@/utils/docs";
import { logError } from "@/utils/logger";
import corsMiddleware from "./middlewares/cors";
import compatRoutes from "./routes/compatRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import faviconRoutes from "./routes/faviconRoutes";
import healthRoutes from "./routes/healthRoutes";
import { ERR } from "./utils/http";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

// --- Middlewares ---
app.use(corsMiddleware);

// --- Error handling ---
app.onError((err, c) => {
	logError(`Unhandled error: ${err.message}`, err);
	return c.json(ERR(err.name, err.message), 500);
});

// --- Routes ---
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
