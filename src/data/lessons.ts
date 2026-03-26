export interface Lesson {
	id: number
	courseId: string
	title: string
	content: string
	isMilestone?: boolean
}

const placeholderContent = `
# Welcome to this Lesson!

This is a placeholder markdown content for this lesson. In a real environment, this content would be fetched from a CMS or a specialized markdown file.

## Learning Objectives
1. Understand the core concepts of this track.
2. Complete the interactive milestone.
3. Earn your on-chain reward.

### Next Steps
When you feel ready, click the **Mark as Complete** button at the bottom of the page to register your progress on the Soroban smart contract and receive your tokens!
`

const stellarLesson1Content = `
# Introduction to Stellar & the Stellar Network

Stellar is an open-source, decentralized network that connects the world's financial infrastructure. It is designed to allow money to be moved and stored quickly, reliably, and at almost no cost.

## What makes Stellar unique?

Unlike many other blockchains, Stellar's primary focus is on **financial inclusion** and the **tokenization of real-world assets**. It achieves this through several core primitives built directly into the protocol.

### Key Concepts

1.  **Assets**: Anything of value can be issued on Stellar. From national currencies (CBDCs and stablecoins) to gold, real estate, or even loyalty points.
2.  **Accounts**: Every user on Stellar has an account identified by a Public Key (G...) and secured by a Secret Seed (S...).
3.  **The Ledger**: A shared, distributed database of every transaction that has ever occurred on the network.
4.  **Trustlines**: To hold an asset other than XLM (the native currency), an account must "trust" the issuer of that asset. This prevents spam and ensures you only receive assets you want.

## Enter Soroban: Smart Contracts on Stellar

Soroban is Stellar's smart contract platform, designed for performance, scalability, and developer-friendliness. It uses WebAssembly (Wasm) and is built to integrate seamlessly with Stellar's existing asset ecosystem.

With Soroban, you can build complex protocols like:
- **DeFi**: Automated Market Makers (AMMs), lending protocols, and derivatives.
- **DAO Governance**: Voting and treasury management.
- **Interoperability**: Bridges and cross-chain communication.

## Learning Objectives for this Track

In this track, you will:
1.  Set up your first Stellar wallet.
2.  Fund your account using the Friendbot on the Testnet.
3.  Perform your first on-chain transaction.
4.  Learn the basics of Soroban contract development.

### Ready to start?
Click the **Mark as Complete** button below to signal your readiness and earn your first learning milestone on LearnVault!
`

export const lessons: Lesson[] = [
	{
		id: 1,
		courseId: "web3-fundamentals",
		title: "What makes ownership portable on the internet?",
		content: placeholderContent,
	},
	{
		id: 2,
		courseId: "web3-fundamentals",
		title: "Wallets vs Accounts",
		content: placeholderContent,
	},
	{
		id: 3,
		courseId: "web3-fundamentals",
		title: "Signing your first transaction",
		content: placeholderContent,
		isMilestone: true,
	},
	{
		id: 1,
		courseId: "defi-protocols",
		title: "How liquidity pools turn deposits into markets",
		content: placeholderContent,
	},
	{
		id: 2,
		courseId: "defi-protocols",
		title: "Automated Market Makers (AMMs)",
		content: placeholderContent,
		isMilestone: true,
	},
	{
		id: 1,
		courseId: "smart-contract-foundations",
		title: "State, events, and the contract execution lifecycle",
		content: placeholderContent,
	},
	{
		id: 2,
		courseId: "smart-contract-foundations",
		title: "Writing a basic storage contract",
		content: placeholderContent,
		isMilestone: true,
	},
	{
		id: 1,
		courseId: "stellar-soroban-basics",
		title: "Your first Stellar transaction on testnet",
		content: placeholderContent,
	},
	{
		id: 2,
		courseId: "stellar-soroban-basics",
		title: "Deploying a Soroban contract",
		content: placeholderContent,
		isMilestone: true,
	},
]

export const getCourseLessons = (courseId: string): Lesson[] => {
	return lessons
		.filter((lesson) => lesson.courseId === courseId)
		.sort((a, b) => a.id - b.id)
}

export const getLesson = (
	courseId: string,
	lessonId: number,
): Lesson | undefined => {
	return lessons.find(
		(lesson) => lesson.courseId === courseId && lesson.id === lessonId,
	)
}
