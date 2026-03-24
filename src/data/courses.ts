export interface Course {
	id: string
	title: string
	track: string
	duration: string
	level: "Beginner" | "Intermediate" | "Advanced"
	description: string
	firstLesson: string
	outcomes: string[]
	accentClassName: string
}

export const courses: Course[] = [
	{
		id: "web3-fundamentals",
		title: "Web3 Fundamentals",
		track: "Web3",
		duration: "4 weeks",
		level: "Beginner",
		description:
			"Build your mental model for wallets, chains, accounts, and how on-chain apps fit together.",
		firstLesson: "What makes ownership portable on the internet?",
		outcomes: ["Wallet basics", "On-chain identity", "Core Web3 vocabulary"],
		accentClassName: "from-sky-400/25 via-cyan-400/15 to-transparent",
	},
	{
		id: "defi-protocols",
		title: "DeFi Protocols",
		track: "DeFi",
		duration: "5 weeks",
		level: "Beginner",
		description:
			"Understand swaps, lending, liquidity, and the mechanics that power decentralized finance.",
		firstLesson: "How liquidity pools turn deposits into markets",
		outcomes: ["AMM intuition", "Yield concepts", "Protocol risk awareness"],
		accentClassName: "from-emerald-400/25 via-teal-400/15 to-transparent",
	},
	{
		id: "smart-contract-foundations",
		title: "Smart Contract Foundations",
		track: "Smart Contracts",
		duration: "6 weeks",
		level: "Beginner",
		description:
			"Learn how contracts execute, store state, and safely automate trust-minimized actions.",
		firstLesson: "State, events, and the contract execution lifecycle",
		outcomes: ["Contract architecture", "State management", "Security mindset"],
		accentClassName: "from-fuchsia-400/25 via-violet-400/15 to-transparent",
	},
	{
		id: "stellar-soroban-basics",
		title: "Stellar & Soroban Basics",
		track: "Stellar",
		duration: "3 weeks",
		level: "Beginner",
		description:
			"Get productive on Stellar testnet with wallets, funding flows, and Soroban-powered apps.",
		firstLesson: "Your first Stellar transaction on testnet",
		outcomes: ["Stellar primitives", "Testnet workflow", "Soroban foundations"],
		accentClassName: "from-brand-cyan/25 via-brand-blue/20 to-transparent",
	},
]
