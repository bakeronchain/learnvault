import { EventEmitter } from "events"

export const LEADERBOARD_UPDATE_EVENT = "leaderboard_update"

/**
 * Singleton emitter for leaderboard updates.
 * Used to notify SSE handlers when new data is available.
 */
class LeaderboardEmitter extends EventEmitter {
	public emitUpdate(): void {
		this.emit(LEADERBOARD_UPDATE_EVENT)
	}
}

export const leaderboardEmitter = new LeaderboardEmitter()
