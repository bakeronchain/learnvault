// Temporary shim for build-time when generated client is not present.
// Replace by running: stellar-scaffold build --build-clients
type GuessArgs = { a_number: bigint; guesser: string }
type SignOpts = { publicKey: string }

function errResult(message: string) {
	return {
		isErr: () => true,
		unwrapErr: () => new Error(message),
		unwrap: () => {
			throw new Error(message)
		},
	}
}

export default {
	async guess(_args: GuessArgs, _opts: SignOpts) {
		const message =
			"Generated contract client not available. Run `stellar-scaffold build --build-clients`."
		return {
			async signAndSend(_opts?: { signTransaction?: unknown }) {
				return { result: errResult(message) }
			},
		}
	},
}
