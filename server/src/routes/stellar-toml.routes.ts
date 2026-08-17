import { Keypair, StrKey } from "@stellar/stellar-sdk"
import { Router } from "express"

function getHomeDomain(): string {
	return (
		process.env.SEP10_HOME_DOMAIN ?? process.env.SERVER_URL ?? "learnvault.app"
	)
}

function getSigningKey(): string {
	const secret = process.env.SEP10_SIGNING_SECRET
	if (!secret) return ""
	try {
		return Keypair.fromSecret(secret).publicKey()
	} catch {
		return ""
	}
}

function getNetworkPassphrase(): string {
	const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase()
	if (network === "mainnet") {
		return "Public Global Stellar Network ; September 2015"
	}
	return "Test SDF Network ; September 2015"
}

export const stellarTomlRouter = Router()

stellarTomlRouter.get("/.well-known/stellar.toml", (_req, res) => {
	const homeDomain = getHomeDomain()
	const signingKey = getSigningKey()
	const networkPassphrase = getNetworkPassphrase()

	const toml = [
		`NETWORK_PASSPHRASE="${networkPassphrase}"`,
		`WEB_AUTH_ENDPOINT="https://${homeDomain}/api/auth/sep10"`,
		`SIGNING_KEY="${signingKey}"`,
		`HORIZON_URL="https://horizon-testnet.stellar.org"`,
		"",
	].join("\n")

	res.type("text/plain").send(toml)
})
