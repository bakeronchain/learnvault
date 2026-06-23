import { processDeadlineReminders } from "../services/deadline-reminder.service"

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const intervalMs = Number.parseInt(
	process.env.DEADLINE_REMINDER_INTERVAL_MS || "",
	10,
)
const pollEveryMs =
	Number.isFinite(intervalMs) && intervalMs > 0
		? intervalMs
		: DEFAULT_INTERVAL_MS

let timer: NodeJS.Timeout | null = null

export async function startDeadlineReminderWorker(): Promise<void> {
	if (timer) {
		return
	}

	console.log(`[deadline-reminder] Worker started (interval=${pollEveryMs}ms)`)

	await processDeadlineReminders()

	timer = setInterval(() => {
		void processDeadlineReminders()
	}, pollEveryMs)
}

export function stopDeadlineReminderWorker(): void {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
	console.log("[deadline-reminder] Worker stopped")
}
