// Legacy TempMail-API compatibility layer.
// Mirrors the old server (http://100.81.10.47:9000) so existing scripts work unchanged.
// Design: this worker is address-based (no tokens), so we set token === address.
import { Hono } from "hono";
import { DOMAINS_SET } from "@/config/domains";
import { createDatabaseService } from "@/database";

const compatRoutes = new Hono<{ Bindings: CloudflareBindings }>();

const TTL = 3600; // seconds (legacy field; real retention is the 2h/3h purge cron)

function randomLocal(len = 10) {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let s = "";
	const buf = new Uint8Array(len);
	crypto.getRandomValues(buf);
	for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
	return s;
}

// GET /api/generate?domain= -> { address, token, expires, ttl }
compatRoutes.get("/api/generate", (c) => {
	const domains = Array.from(DOMAINS_SET);
	const requested = c.req.query("domain");
	const domain = requested && DOMAINS_SET.has(requested) ? requested : domains[0];
	const address = `${randomLocal()}@${domain}`;
	const now = Math.floor(Date.now() / 1000);
	return c.json({ address, token: address, expires: now + TTL, ttl: TTL });
});

// GET /api/domains -> ["kadangkesel.site", ...]
compatRoutes.get("/api/domains", (c) => {
	return c.json(Array.from(DOMAINS_SET));
});

// GET /api/inbox?token=ADDRESS -> messages newest first
compatRoutes.get("/api/inbox", async (c) => {
	const token = c.req.query("token");
	if (!token) return c.json({ error: "token required" }, 400);
	const db = createDatabaseService(c.env.D1);
	const { results, error } = await db.getEmailsByRecipient(token, 50, 0);
	if (error) return c.json({ error: error.message }, 500);
	const messages = (results || []).map((m: any) => ({
		id: m.id,
		from: m.from_address,
		to: m.to_address,
		subject: m.subject,
		date: m.received_at,
		received_at: m.received_at,
		has_attachments: m.has_attachments,
		attachment_count: m.attachment_count,
	}));
	return c.json({ address: token, token, messages });
});

// GET /api/message/:id?token=ADDRESS -> body_text / body_html
compatRoutes.get("/api/message/:id", async (c) => {
	const id = c.req.param("id");
	const db = createDatabaseService(c.env.D1);
	const { result, error } = await db.getEmailById(id);
	if (error) return c.json({ error: error.message }, 500);
	if (!result) return c.json({ error: "message not found" }, 404);
	const r: any = result;
	return c.json({
		id: r.id,
		from: r.from_address,
		to: r.to_address,
		subject: r.subject,
		date: r.received_at,
		received_at: r.received_at,
		body_text: r.text_content ?? "",
		body_html: r.html_content ?? "",
		has_attachments: r.has_attachments,
		attachment_count: r.attachment_count,
	});
});

// POST /api/renew?token=ADDRESS -> no-op (retention is cron-based); echo new expiry
compatRoutes.post("/api/renew", (c) => {
	const token = c.req.query("token");
	if (!token) return c.json({ error: "token required" }, 400);
	const now = Math.floor(Date.now() / 1000);
	return c.json({ address: token, token, expires: now + TTL, ttl: TTL, renewed: true });
});

// POST /api/release?token=ADDRESS -> delete inbox
compatRoutes.post("/api/release", async (c) => {
	const token = c.req.query("token");
	if (!token) return c.json({ error: "token required" }, 400);
	const db = createDatabaseService(c.env.D1);
	const { meta, error } = await db.deleteEmailsByRecipient(token);
	if (error) return c.json({ error: error.message }, 500);
	return c.json({ released: true, deleted_count: meta?.changes ?? 0 });
});

export default compatRoutes;
