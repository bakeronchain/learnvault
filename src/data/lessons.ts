export interface Lesson {
	id: number
	courseId: string
	title: string
	content: string
	isMilestone?: boolean
}

const web3Lesson1Content = `
# What makes ownership portable on the internet?

## Introduction
Traditional internet platforms let you access digital items, but they usually keep the actual records of ownership inside private databases. Web3 changes that model by storing ownership in shared ledgers that anyone can verify. That makes assets portable: you can carry them between apps, wallets, and communities without asking one company for permission.

## Learning Objectives
- Explain the difference between platform-controlled access and user-controlled ownership.
- Describe how blockchains create shared records of who owns what.
- Identify why portability matters for creators, learners, and online communities.

## Main Content
### From rented space to owned assets
On most Web2 platforms, your identity, purchases, followers, and achievements live inside one company's system. If the product changes its rules, shuts down, or suspends your account, your access can disappear. In Web3, the source of truth is a blockchain account and the assets attached to it. Apps can read that state, but they do not fully control it.

### Why shared ledgers matter
A blockchain acts like a public coordination layer. Instead of every app keeping its own secret spreadsheet, participants agree on a common history of transactions. That history records ownership, transfers, and permissions in a way that other apps can verify independently.

### Portability in practice
Portable ownership means the same wallet can unlock multiple experiences:
- A governance token can grant voting rights in one app and membership perks in another.
- A certificate NFT can represent proof of course completion across learning platforms.
- A stablecoin balance can move from a savings app to a payment app without needing a platform-specific export process.

### What users are actually controlling
Ownership does not always mean controlling the media file or the app itself. It usually means controlling the key that can prove access to an on-chain asset. If your wallet holds the asset, you can authorize transfers, votes, or interactions from any compatible interface.

### Risks and tradeoffs
Portability is powerful, but it comes with responsibility:
- You must protect your private keys.
- Transactions may be irreversible.
- Public ledgers make activity easier to audit, which can affect privacy.
- Some experiences still depend on off-chain services like storage, indexing, or moderation.

## Summary
Web3 makes ownership portable by moving the record of assets and permissions into a shared ledger instead of a single company's database. That portability lets people reuse identities, tokens, and achievements across products while taking on more direct responsibility for security.
`

const web3Lesson2Content = `
# Wallets vs Accounts

## Introduction
People often use the terms "wallet" and "account" interchangeably, but they solve different problems. An account is the on-chain identity that owns assets and appears in the ledger. A wallet is the tool you use to view that account, manage keys, and approve actions.

## Learning Objectives
- Distinguish between a blockchain account and a wallet application.
- Understand how public keys, private keys, and signing relate to ownership.
- Recognize why one wallet can manage multiple accounts and vice versa.

## Main Content
### What an account is
A blockchain account is an entry on the network. It has an address, may hold tokens or NFTs, and has rules about who can update it. On Stellar, for example, the account is represented by a public key and ledger state such as balances, trustlines, and signers.

### What a wallet is
A wallet is software or hardware that helps you interact with accounts. It may:
- Generate and store key material.
- Show balances and transaction history.
- Ask you to review and sign transactions.
- Connect to dApps through a browser extension, mobile app, or hardware device.

### Keys are the bridge
The wallet is useful because it manages secret material safely. The blockchain never sees your private key directly. Instead, your wallet uses the key to produce a signature that proves you approved a transaction. The network checks the signature against the account's public key.

### Common misconceptions
- "My wallet holds coins." Technically, assets live on-chain. The wallet displays and controls access to them.
- "If I switch wallets, I lose my assets." Not if you still control the same secret or recovery method. A different wallet can manage the same account.
- "One person equals one wallet." In reality, people may use separate accounts for savings, governance, work, or experimentation.

### Security implications
Because the wallet protects the keys, wallet security is account security. Good practices include using strong authentication, storing recovery phrases offline, confirming transaction details carefully, and preferring hardware wallets for higher-value accounts.

## Summary
An account is the on-chain identity that owns assets, while a wallet is the interface that helps you manage keys and authorize actions for that account. Keeping that distinction clear makes it easier to understand custody, recovery, and transaction signing.
`

const web3Lesson3Content = `
# Signing your first transaction

## Introduction
Signing is the moment where blockchain ownership becomes action. Reading data is passive, but sending tokens, voting, or completing an on-chain milestone all require a valid signature. Understanding this flow helps you spot risky prompts and use wallets with confidence.

## Learning Objectives
- Describe the lifecycle of a typical blockchain transaction.
- Explain what a digital signature proves.
- Review a transaction before approving it in a wallet.

## Main Content
### Step 1: Build the intent
Every transaction starts with an intent such as "send 5 tokens," "vote yes," or "complete this lesson milestone." The app translates that intent into structured transaction data: destination, function call, network, fees, and sometimes a deadline.

### Step 2: Review what will happen
Before signing, inspect the request carefully:
- Which network are you on?
- Which contract or address will receive the transaction?
- Are you spending tokens, granting approval, or only making a read-only call?
- What fee will you pay?

If something is unclear, do not approve it just because the UI looks familiar.

### Step 3: Sign with your wallet
Your wallet creates a digital signature using the private key for the account. That signature proves the request came from an authorized signer and that the transaction was not altered after you reviewed it.

### Step 4: Broadcast to the network
After signing, the transaction is submitted to the network. Validators check the signature, confirm the transaction is valid, and include it in the ledger if all rules pass.

### Step 5: Wait for confirmation
Once confirmed, the ledger updates and the app can refresh balances, voting state, or milestone progress. Some apps show immediate optimistic updates, but the on-chain confirmation is the final source of truth.

### Milestone checklist
When you sign your first real transaction in LearnVault, you should be able to answer:
- What action am I authorizing?
- Which account is signing?
- What changes if the transaction succeeds?
- What is the safest next step if something looks wrong?

## Summary
Signing a transaction means reviewing structured intent, approving it with your wallet, and letting the network verify your signature before state changes are recorded. Safe habits start with understanding exactly what you are authorizing before you click approve.
`

const defiLesson1Content = `
# How liquidity pools turn deposits into markets

## Introduction
In traditional finance, market makers continuously quote prices so buyers and sellers can trade. DeFi protocols often replace that role with liquidity pools: shared reserves of tokens deposited by users. Those deposits create an always-available market that traders can interact with directly.

## Learning Objectives
- Explain what a liquidity pool is and why it exists.
- Describe how pooled assets make swapping possible without an order book.
- Recognize the incentives and risks for liquidity providers.

## Main Content
### What goes into a pool
A liquidity pool usually holds two or more assets, such as USDC and XLM. Liquidity providers deposit those assets into a smart contract according to the protocol's rules. In exchange, they receive LP tokens or another accounting record showing their share of the pool.

### How traders use the pool
Instead of matching with another person, a trader sends one asset into the pool and receives another asset out of it. The contract calculates how much they receive based on the pool balances and pricing formula. This means a market can function even when no active counterparty is online at that moment.

### Why deposits create market depth
The more assets inside the pool, the easier it is for traders to swap with lower slippage. Large pools can absorb bigger trades before the price moves sharply. Small pools are still useful, but they tend to produce worse execution for larger orders.

### Where returns come from
Liquidity providers are compensated because their capital makes the market possible. Common revenue sources include:
- Swap fees paid by traders.
- Token incentives distributed by the protocol.
- Governance rewards for supporting strategic markets.

### The main risks
Providing liquidity is not the same as holding tokens in a wallet. Risks include:
- Impermanent loss when asset prices diverge.
- Smart contract bugs.
- Low volume leading to weak fee generation.
- Pool-specific governance or oracle issues.

## Summary
Liquidity pools turn idle deposits into on-chain markets by making reserves available for algorithmic trading. They give protocols continuous liquidity, reward capital providers, and introduce risks that differ from simple token holding.
`

const defiLesson2Content = `
# Automated Market Makers (AMMs)

## Introduction
Automated Market Makers are the pricing engines behind many liquidity pools. Instead of relying on a human market maker to post bids and asks, an AMM uses a formula to determine how prices change as trades move assets in and out of the pool.

## Learning Objectives
- Define an AMM and describe how it differs from an order-book exchange.
- Understand the relationship between pool balances, price, and slippage.
- Explain why AMM design choices affect capital efficiency and user experience.

## Main Content
### The constant product idea
One of the most common AMM models uses the rule x * y = k, where x and y are the pool balances and k stays constant after accounting for fees. If a trader removes one asset, they must add enough of the other asset so the formula still holds. That balance shift changes the effective price.

### Why prices move during a trade
AMMs quote prices from the current ratio of assets in the pool. A large trade pushes that ratio further than a small trade, which is why slippage increases with trade size relative to pool depth.

### Fees and incentives
Each trade typically includes a fee. The fee can:
- Reward liquidity providers.
- Offset some of the impact of impermanent loss.
- Help discourage unnecessary arbitrage churn.

### AMM design variations
Not all AMMs use the same formula:
- Constant product AMMs are flexible and common for volatile pairs.
- Stable-swap AMMs are optimized for similarly priced assets like stablecoins.
- Concentrated liquidity AMMs let providers choose narrower price ranges to use capital more efficiently.

### What learners should evaluate
When using or building an AMM, ask:
- Is this model appropriate for the assets in the pool?
- How large is the expected slippage for typical users?
- Who earns the fees and under what conditions?
- What happens during sudden volatility?

## Summary
AMMs replace manual quoting with formulas that update prices automatically as pool balances change. Understanding the pricing model, fee structure, and slippage behavior is essential whether you are trading, providing liquidity, or designing a DeFi protocol.
`

const contractLesson1Content = `
# State, events, and the contract execution lifecycle

## Introduction
Smart contracts are programs, but they are not long-running servers. They execute when someone submits a transaction or call, read and write state according to deterministic rules, emit events, and then stop. To build reliable contracts, you need to understand that lifecycle clearly.

## Learning Objectives
- Define contract state and explain why it must be stored explicitly.
- Describe how events communicate what happened during execution.
- Walk through the lifecycle of a contract call from input to final state.

## Main Content
### State is durable memory
Contract state is the data that persists between executions. Examples include token balances, proposal records, enrollment status, and configuration values. Because execution is stateless between calls, anything you need later must be written into storage.

### Events are structured signals
Events are append-only messages emitted during execution. They do not usually change state by themselves, but they help wallets, indexers, and frontends react to what happened. For example, a contract may emit an event when a learner completes a milestone or when a vote is cast.

### The execution lifecycle
1. A caller submits a transaction or invokes a contract method.
2. The runtime loads the contract code and relevant state.
3. The contract validates inputs and authorization.
4. Business logic runs and may update storage.
5. Events are emitted for important actions.
6. The runtime commits the result if execution succeeds, or reverts if it fails.

### Why deterministic execution matters
Every validator must reach the same output for the same input. That means contract code cannot rely on hidden local state, random network calls, or anything else that would behave differently across machines unless the protocol provides a controlled mechanism for it.

### Designing for observability
A good contract uses storage for durable truths and events for useful signals. Frontends should treat state as the source of truth, while events help with responsive UX, analytics, and indexing.

## Summary
Contract calls follow a predictable lifecycle: load state, validate, execute, emit events, and either commit or revert. Durable state stores the system's truth, while events make that truth easier for external tools to observe.
`

const contractLesson2Content = `
# Writing a basic storage contract

## Introduction
A storage contract is the simplest place to practice smart contract design. It teaches you how to define data, validate input, update state safely, and expose read methods that frontends can call without unnecessary complexity.

## Learning Objectives
- Model a small piece of contract state clearly.
- Separate write methods from read methods.
- Think through validation, versioning, and frontend integration for a basic contract.

## Main Content
### Start with one clear responsibility
A good beginner contract should do one thing well, such as storing a learner profile, a settings record, or a single key-value entry. Keeping the surface area small makes it easier to reason about permissions and test behavior.

### Define the storage schema
Before coding, decide:
- Which keys will be written?
- What type each value should have?
- Who is allowed to change it?
- What should happen if the value is missing?

On Soroban or similar platforms, this often means creating predictable storage keys and encoding values in a type-safe way.

### Separate writes from reads
Write methods change ledger state and usually require authorization. Read methods only return data. This separation helps wallets, frontends, and indexers understand which interactions need signatures and which can be simulated safely.

### Validate before writing
Even simple contracts need guardrails:
- Reject empty or malformed values.
- Enforce ownership or admin permissions.
- Prevent accidental overwrites when appropriate.
- Emit events so off-chain tools can track updates.

### Milestone mindset
For LearnVault, a useful exercise is imagining a contract that stores milestone completion metadata. The contract would need learner identifiers, course references, validation logic, and an event that signals a new completion.

## Summary
A basic storage contract teaches the core habits of smart contract engineering: define state intentionally, validate every write, expose clear read paths, and keep the contract focused on one responsibility at a time.
`

const stellarLesson1Content = `
# Your first Stellar transaction on testnet

## Introduction
Testnet is the safest place to build confidence with Stellar. It lets you fund a temporary account, inspect balances, and submit transactions without risking real funds. Your first transaction is less about moving value and more about understanding the workflow end to end.

## Learning Objectives
- Set up and fund a Stellar testnet account.
- Identify the pieces of a basic Stellar transaction.
- Submit a transaction and confirm it on the network.

## Main Content
### Create and fund an account
On Stellar, an account needs a valid keypair and enough XLM to exist on the ledger. On testnet, developers usually use Friendbot to create and fund an account automatically. That gives you a safe sandbox for experimentation.

### Know the transaction components
A Stellar transaction typically includes:
- A source account.
- One or more operations.
- A sequence number to prevent replay.
- A fee.
- A network passphrase that ties the transaction to testnet or mainnet.

### Example beginner flow
A first transaction might be a simple payment, adding a trustline, or invoking a contract from a wallet-enabled frontend. The core idea is the same:
1. Build the transaction payload.
2. Review the source account and intended operation.
3. Sign with your wallet or secret key in a safe environment.
4. Submit the transaction to an RPC or Horizon-compatible service.
5. Confirm the result and inspect ledger changes.

### What to verify afterward
After submission, check:
- Did the sequence number advance?
- Did balances or trustlines change as expected?
- Is the transaction hash available for lookup?
- Did the app show the same result the network recorded?

## Summary
Your first Stellar transaction on testnet teaches the basic execution path: create an account, build an operation, sign it, submit it, and verify the ledger outcome. Once that loop feels familiar, more advanced contract interactions become much easier to reason about.
`

const stellarLesson2Content = `
# Deploying a Soroban contract

## Introduction
Deploying a Soroban contract is the moment your code becomes a live on-chain service. To do it safely, you need more than just compiled Wasm. You also need to understand network selection, deployment credentials, initialization, and post-deploy verification.

## Learning Objectives
- Outline the steps required to deploy a Soroban contract.
- Explain why initialization and environment configuration matter.
- Verify a deployment before a frontend starts relying on it.

## Main Content
### Prepare the contract artifact
Soroban contracts are compiled to WebAssembly. Before deployment, make sure the Wasm artifact matches the code you intend to ship, that the contract builds cleanly, and that any generated client bindings are refreshed if your interface changed.

### Choose the right network and signer
Deployment depends on:
- The target network, such as testnet.
- An account with enough funds to pay fees.
- The correct network passphrase and RPC endpoint.
- A deployment workflow that records the resulting contract ID.

### Initialize contract state
Many contracts need a setup step after deployment, such as configuring an admin, setting token addresses, or writing initial parameters. Skipping initialization can leave the contract unusable or insecure.

### Verify before integrating
After deployment:
- Call a simple read method to confirm the contract responds.
- Check that version metadata matches the frontend's expectations.
- Store the contract ID in environment configuration or a registry.
- Test one controlled interaction end to end from the frontend.

### Common mistakes
- Deploying to the wrong network.
- Forgetting to update environment variables.
- Using stale generated clients after the interface changed.
- Assuming deployment succeeded without verifying a read call or emitted event.

## Summary
Deploying a Soroban contract means compiling the artifact, publishing it to the correct network, initializing required state, and verifying that the deployed interface matches what your application expects. A successful deployment is only complete once the frontend can use it confidently.
`

export const lessons: Lesson[] = [
	{
		id: 1,
		courseId: "web3-fundamentals",
		title: "What makes ownership portable on the internet?",
		content: web3Lesson1Content,
	},
	{
		id: 2,
		courseId: "web3-fundamentals",
		title: "Wallets vs Accounts",
		content: web3Lesson2Content,
	},
	{
		id: 3,
		courseId: "web3-fundamentals",
		title: "Signing your first transaction",
		content: web3Lesson3Content,
		isMilestone: true,
	},
	{
		id: 4,
		courseId: "defi-protocols",
		title: "How liquidity pools turn deposits into markets",
		content: defiLesson1Content,
	},
	{
		id: 5,
		courseId: "defi-protocols",
		title: "Automated Market Makers (AMMs)",
		content: defiLesson2Content,
		isMilestone: true,
	},
	{
		id: 6,
		courseId: "smart-contract-foundations",
		title: "State, events, and the contract execution lifecycle",
		content: contractLesson1Content,
	},
	{
		id: 7,
		courseId: "smart-contract-foundations",
		title: "Writing a basic storage contract",
		content: contractLesson2Content,
		isMilestone: true,
	},
	{
		id: 8,
		courseId: "stellar-soroban-basics",
		title: "Your first Stellar transaction on testnet",
		content: stellarLesson1Content,
	},
	{
		id: 9,
		courseId: "stellar-soroban-basics",
		title: "Deploying a Soroban contract",
		content: stellarLesson2Content,
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
