// Temporary shim for build-time when the generated client is not present.
// Replace by running: stellar-scaffold build --build-clients

export default {
	async balance() {
		return 0n
	},
	async get_balance() {
		return 0n
	},
	async get_voting_power() {
		return 0n
	},
	async get_delegate() {
		return null
	},
	async delegate() {
		return { result: null }
	},
	async undelegate() {
		return { result: null }
	},
}
