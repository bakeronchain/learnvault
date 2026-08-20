// A commit-reveal vote is only as good as the juror's ability to reveal it
// later with the exact same (vote, salt) pair. There is no way to recover a
// randomly generated salt after the fact, so it has to be persisted
// somewhere the browser controls between the commit and reveal steps.
// localStorage, scoped per wallet address, is good enough for that -- this
// is convenience state, not a security boundary (the commitment on-chain is
// what actually binds the vote).

interface StoredVote {
	vote: boolean
	saltHex: string
}

function storageKey(walletAddress: string): string {
	return `learnvault:dispute-votes:${walletAddress}`
}

function readAll(walletAddress: string): Record<string, StoredVote> {
	try {
		const raw = localStorage.getItem(storageKey(walletAddress))
		return raw ? (JSON.parse(raw) as Record<string, StoredVote>) : {}
	} catch {
		return {}
	}
}

export function saveVote(
	walletAddress: string,
	disputeId: string,
	vote: boolean,
	saltHex: string,
): void {
	const all = readAll(walletAddress)
	all[disputeId] = { vote, saltHex }
	try {
		localStorage.setItem(storageKey(walletAddress), JSON.stringify(all))
	} catch {
		// Storage full or unavailable -- the juror will need to note their
		// salt manually. Nothing more we can do client-side.
	}
}

export function getStoredVote(
	walletAddress: string,
	disputeId: string,
): StoredVote | null {
	return readAll(walletAddress)[disputeId] ?? null
}
