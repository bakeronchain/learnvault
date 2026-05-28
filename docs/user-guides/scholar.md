# Scholar Onboarding Guide

This guide walks you through using LearnVault as a scholar — from setting up your wallet to earning LRN tokens and participating in governance.

## 1. Set Up a Stellar Wallet (Freighter)

1. Install the [Freighter browser extension](https://www.freighter.app/).
2. Create a new wallet and securely store your seed phrase.
3. Switch the network to **Testnet** for exploration or **Mainnet** for live participation.
4. Fund your wallet with a small amount of XLM (needed for transaction fees).

## 2. Connect to LearnVault

1. Visit the LearnVault app and click **Connect Wallet**.
2. Select **Freighter** from the wallet options.
3. Approve the connection request in the Freighter popup.
4. Your wallet address will appear in the top navigation once connected.

## 3. Browse and Enroll in Courses

1. Navigate to the **Courses** section from the dashboard.
2. Filter by category, skill level, or scholarship availability.
3. Click a course to view its syllabus, milestones, and LRN reward structure.
4. Click **Enroll** — this signs an on-chain enrollment transaction via Freighter.

## 4. Complete Lessons and Milestones

- Each course is divided into **milestones**. Completing a milestone unlocks the next and triggers a reward.
- Progress is tracked on-chain via the `milestone_escrow` contract.
- Mark a lesson complete from the course dashboard after finishing the required material.

## 5. Submit Evidence (GitHub + IPFS)

1. Push your project or assignment to a public GitHub repository.
2. Pin your evidence to IPFS (e.g., via [Pinata](https://pinata.cloud/) or the LearnVault upload tool).
3. In the milestone submission form, paste your **GitHub URL** and **IPFS CID**.
4. Submit — a reviewer or automated oracle will verify and approve the milestone on-chain.

## 6. Apply for a Scholarship

1. From the **Scholarships** tab, browse open scholarship pools.
2. Click **Apply** on an eligible pool and complete the application form.
3. Your application is submitted to the governance contract for donor review.
4. You will be notified when your application is approved or requires more information.

## 7. Earn and View LRN Tokens

- LRN tokens are released to your wallet automatically upon milestone approval.
- View your balance in the **Wallet** section of the dashboard or directly in Freighter.
- LRN tokens represent learning reputation and are used for governance voting.

## 8. Vote on Governance Proposals

1. Navigate to **Governance** from the main menu.
2. Browse active proposals (scholarship approvals, platform updates, fee changes).
3. Click a proposal to read the description and cast your vote using your LRN balance.
4. Votes are recorded on-chain — one LRN = one vote.
