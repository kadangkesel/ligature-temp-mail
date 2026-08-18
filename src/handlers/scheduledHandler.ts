import * as db from "@/database/d1";
import * as r2 from "@/database/r2";
import { now } from "@/utils/helpers";
import { logError, logInfo } from "@/utils/logger";
import { sendMessage } from "@/utils/telegram";

/**
 * Cloudflare Scheduled Function
 * Delete emails older than HOURS_TO_DELETE_D1, plus their R2 attachments.
 */
export async function handleScheduled(
	_event: ScheduledEvent,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	const cutoffTimestamp = now() - env.HOURS_TO_DELETE_D1 * 60 * 60;

	// Collect R2 keys first — the FK cascade destroys the attachment rows (and so
	// the only record of these keys) the moment the emails are deleted, leaving
	// the objects stranded in the bucket forever.
	const { keys, error: keysError } = await db.getExpiringAttachmentKeys(env.D1, cutoffTimestamp);
	if (keysError) {
		logError("Could not list expiring attachment keys; objects may be orphaned", keysError);
	}

	const { success, error } = await db.deleteOldEmails(env.D1, cutoffTimestamp);

	if (!success) {
		const errorMessage = `❌ Email cleanup failed: ${error?.message || "Unknown error"}`;
		ctx.waitUntil(sendMessage(errorMessage, env));
		throw new Error(errorMessage);
	}

	// Best-effort: the D1 rows are already gone, so a failure here costs storage,
	// not correctness. Never fail the cron over it.
	let deletedObjects = 0;
	for (const key of keys) {
		const { success: r2Success, error: r2Error } = await r2.deleteAttachment(env.R2, key);
		if (r2Success) deletedObjects++;
		else logError(`Failed to delete R2 object ${key}`, r2Error);
	}

	logInfo(
		`Email cleanup completed successfully. Deleted ${deletedObjects}/${keys.length} objects.`,
	);
	ctx.waitUntil(
		sendMessage(
			`✅ Email cleanup completed successfully. Attachments purged: ${deletedObjects}/${keys.length}.`,
			env,
		),
	);
}
