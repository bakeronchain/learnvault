/**
 * Curated allowlist of vetted Stellar anchors for cash-out (#1053).
 *
 * This is the phishing-vector guard the issue calls out: every anchor
 * domain the backend will ever call MUST be looked up through this file
 * first. No caller-supplied domain is ever passed straight to `fetch` — see
 * getAnchorConfig() in services/anchor.service.ts, which every anchor route
 * and service function routes through before any network I/O.
 *
 * Seeded with Stellar's own public testnet reference anchor
 * (testanchor.stellar.org — the standard SDF reference implementation used
 * throughout Stellar's SEP-24 documentation and quickstart guides), which is
 * exactly what this issue's own testing note asks for. Real production
 * anchors (e.g. specific Nigerian/Kenyan providers) are deliberately NOT
 * listed here — adding one is an ops decision (vetting, compliance, a real
 * relationship with the anchor) for this team to make, not something to
 * invent. Add entries here once an anchor has actually been vetted.
 */

export interface AnchorConfig {
	/** Anchor's home domain — used to resolve its stellar.toml. No scheme/path. */
	domain: string
	/** Human-readable name for display. */
	name: string
	/** ISO 3166-1 alpha-2 country codes this anchor serves. */
	countries: string[]
}

export const ANCHOR_ALLOWLIST: AnchorConfig[] = [
	{
		domain: "testanchor.stellar.org",
		name: "Stellar Testnet Reference Anchor",
		// Test/dev metadata only — this is the SDF reference implementation,
		// not a real regulated provider for any of these countries.
		countries: ["NG", "KE", "GH"],
	},
]

export function getAnchorConfig(domain: string): AnchorConfig | undefined {
	return ANCHOR_ALLOWLIST.find((a) => a.domain === domain)
}

export function isAllowlistedAnchor(domain: string): boolean {
	return getAnchorConfig(domain) !== undefined
}

export function listAnchorConfigsForCountry(country?: string): AnchorConfig[] {
	if (!country) return ANCHOR_ALLOWLIST
	const upper = country.toUpperCase()
	return ANCHOR_ALLOWLIST.filter((a) => a.countries.includes(upper))
}
