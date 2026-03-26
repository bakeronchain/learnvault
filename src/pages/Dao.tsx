import { Button, Card, Input, Text } from "@stellar/design-system"
import { useMemo, useState } from "react"

import { useWallet } from "../hooks/useWallet"

export default function Dao() {
	const { address } = useWallet()

	type Proposal = {
		id: string
		title: string
		amountUsdc: string
		createdAtIso: string
		votesYes: number
	}

	const proposalsKey = useMemo(
		() => (address ? `dao:proposals:${address}` : "dao:proposals:anon"),
		[address],
	)
	const governanceKey = useMemo(
		() => (address ? `dao:gov:${address}` : "dao:gov:anon"),
		[address],
	)

	const [title, setTitle] = useState("Scholarship for Stellar Basics")
	const [amountUsdc, setAmountUsdc] = useState("100")
	const [isGovHolder, setIsGovHolder] = useState(() => {
		return localStorage.getItem(governanceKey) === "1"
	})
	const [govTokens, setGovTokens] = useState(() => {
		const raw = localStorage.getItem(`${governanceKey}:tokens`)
		return raw ? Number(raw) || 0 : 0
	})

	const [proposals, setProposals] = useState<Proposal[]>(() => {
		try {
			const raw = localStorage.getItem(proposalsKey)
			return raw ? (JSON.parse(raw) as Proposal[]) : []
		} catch {
			return []
		}
	})

	const persistProposals = (next: Proposal[]) => {
		setProposals(next)
		localStorage.setItem(proposalsKey, JSON.stringify(next))
	}

	const submitProposal = () => {
		if (!address) return
		const id = String(Date.now())
		const next: Proposal[] = [
			{
				id,
				title,
				amountUsdc,
				createdAtIso: new Date().toISOString(),
				votesYes: 0,
			},
			...proposals,
		]
		persistProposals(next)
	}

	const voteYes = (id: string) => {
		if (!isGovHolder) return
		const next = proposals.map((p) =>
			p.id === id ? { ...p, votesYes: p.votesYes + 1 } : p,
		)
		persistProposals(next)
	}

	const depositUsdc = () => {
		if (!address) return
		const next = govTokens + 10
		setGovTokens(next)
		localStorage.setItem(`${governanceKey}:tokens`, String(next))
		setIsGovHolder(true)
		localStorage.setItem(governanceKey, "1")
	}

	return (
		<div>
			<Text as="h1" size="lg">
				DAO
			</Text>

			<Card>
				<Text as="h2" size="md">
					Submit scholarship proposal
				</Text>
				{!address ? (
					<Text as="p" size="sm">
						Connect wallet to submit.
					</Text>
				) : (
					<div style={{ display: "grid", gap: "0.75rem", maxWidth: 520 }}>
						<Input
							id="proposal-title"
							label="Title"
							fieldSize="md"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
						<Input
							id="proposal-amount"
							label="Amount (USDC)"
							fieldSize="md"
							value={amountUsdc}
							onChange={(e) => setAmountUsdc(e.target.value)}
						/>
						<Button
							variant="primary"
							size="md"
							data-testid="submit-proposal"
							onClick={submitProposal}
						>
							Submit Proposal
						</Button>
					</div>
				)}
			</Card>

			<Card>
				<Text as="h2" size="md">
					Treasury (Donor)
				</Text>
				<Text as="p" size="sm">
					Deposit USDC → receive governance tokens.
				</Text>
				<Button
					variant="secondary"
					size="md"
					data-testid="deposit-usdc"
					disabled={!address}
					onClick={depositUsdc}
				>
					Deposit USDC
				</Button>
				<Text as="div" size="sm" data-testid="gov-token-balance">
					Governance Tokens: {govTokens}
				</Text>
			</Card>

			<Card>
				<Text as="h2" size="md">
					Active proposals
				</Text>
				{proposals.length === 0 ? (
					<Text as="p" size="sm">
						No proposals yet.
					</Text>
				) : (
					<div style={{ display: "grid", gap: "0.75rem" }}>
						{proposals.map((p) => (
							<Card key={p.id}>
								<Text as="div" size="sm" data-testid="proposal-title">
									{p.title}
								</Text>
								<Text as="div" size="sm">
									Requested: {p.amountUsdc} USDC
								</Text>
								<Text as="div" size="sm" data-testid="vote-count">
									Votes YES: {p.votesYes}
								</Text>
								<Button
									variant="primary"
									size="sm"
									data-testid="vote-yes"
									disabled={!isGovHolder}
									onClick={() => voteYes(p.id)}
								>
									Vote YES
								</Button>
							</Card>
						))}
					</div>
				)}
			</Card>
		</div>
	)
}
