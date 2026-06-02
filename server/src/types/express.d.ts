declare global {
	namespace Express {
		interface Request {
			/** Correlation ID attached to each request */
			requestId?: string
			/** Stellar public key (G...) after JWT verification */
			walletAddress?: string
		}
	}
}

export {}
