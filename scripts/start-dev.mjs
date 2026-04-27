import { spawn, spawnSync } from "node:child_process"

function run(command, args, name) {
	const child = spawn(command, args, {
		stdio: "inherit",
		shell: true,
		windowsHide: false,
	})

	child.on("exit", (code) => {
		if (code !== 0) {
			process.exit(code ?? 1)
		}
	})

	child.on("error", (error) => {
		console.error(`[learnvault] Failed to start ${name}:`, error.message)
		process.exit(1)
	})

	return child
}

function hasStellarCli() {
	const result = spawnSync("stellar", ["--version"], {
		shell: true,
		stdio: "ignore",
		windowsHide: true,
	})

	return result.status === 0
}

const vite = run("vite", [], "vite")

if (hasStellarCli()) {
	run("stellar", ["scaffold", "watch", "--build-clients"], "stellar")
} else {
	console.warn(
		"[learnvault] Stellar CLI not found. Starting frontend only.\n" +
			"[learnvault] Install with: npm install -g @stellar/stellar-cli",
	)
}

process.on("SIGINT", () => {
	vite.kill("SIGINT")
})

process.on("SIGTERM", () => {
	vite.kill("SIGTERM")
})
