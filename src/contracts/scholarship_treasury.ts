// Temporary shim for build-time when the generated client is not present.
// Replace by running: stellar-scaffold build --build-clients

type VoteArgs = { proposal_id: number; voter: string; support: boolean }

function errResult(message: string) {
	return {
		isErr: () => true,
		unwrapErr: () => new Error(message),
		unwrap: () => {
			throw new Error(message)
		},
	}
}

const unavailableMessage =
	"Generated contract client not available. Run `stellar-scaffold build --build-clients`."

export default {
	async get_active_proposals() {
		return []
	},
	async get_proposals_by_status(_status: unknown) {
		return []
	},
	async has_voted() {
		return false
	},
	async vote(_args: VoteArgs, _opts?: { publicKey?: string }) {
		return {
			async signAndSend(_opts?: { signTransaction?: unknown }) {
				return { result: errResult(unavailableMessage) }
			},
		}
	},
}
