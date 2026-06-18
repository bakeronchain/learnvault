import { EventEmitter } from "events"

export const TOKEN_BURNED_EVENT = "token_burned"

export interface TokenBurnedPayload {
	walletAddress: string
	amount: string
	txHash: string
	timestamp: string
}

/**
 * Emits real-time token events for SSE subscribers (e.g. balance widget).
 */
class TokenEventsEmitter extends EventEmitter {
	emitTokenBurned(payload: TokenBurnedPayload): void {
		this.emit(TOKEN_BURNED_EVENT, payload)
	}
}

export const tokenEventsEmitter = new TokenEventsEmitter()
