import { Button, Card, Text } from "@stellar/design-system"
import { Link } from "react-router-dom"
import { useProposals } from "../hooks/useProposals"
import { useWallet } from "../hooks/useWallet"

export default function Dao() {
	const { address } = useWallet()
	const { proposals, votingPower, isLoading } = useProposals()

	return (
		<div>
			<Text as="h1" size="lg">
				DAO
			</Text>

			<Card>
				<Text as="h2" size="md">
					Governance hub
				</Text>
				<Text as="p" size="sm">
					Browse live proposals from the backend API and create new ones without
					local proposal storage.
				</Text>
				<div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
					<Link to="/dao/proposals">
						<Button variant="primary" size="md" data-testid="view-proposals">
							View Proposals
						</Button>
					</Link>
					<Link to="/dao/propose">
						<Button
							variant="secondary"
							size="md"
							disabled={!address}
							data-testid="create-proposal"
						>
							Create Proposal
						</Button>
					</Link>
				</div>
			</Card>

			<Card>
				<Text as="h2" size="md">
					Voting power
				</Text>
				<Text as="div" size="sm" data-testid="gov-token-balance">
					Governance Tokens: {votingPower.toString()}
				</Text>
				<Text as="p" size="sm">
					{address
						? "Connect your proposal and voting flow through the live DAO endpoints."
						: "Connect wallet to create proposals and vote."}
				</Text>
			</Card>

			<Card>
				<Text as="h2" size="md">
					Recent proposals
				</Text>
				{isLoading ? (
					<Text as="p" size="sm">
						Loading proposals...
					</Text>
				) : proposals.length === 0 ? (
					<Text as="p" size="sm">
						No proposals available yet.
					</Text>
				) : (
					<div style={{ display: "grid", gap: "0.75rem" }}>
						{proposals.slice(0, 3).map((proposal) => (
							<Card key={proposal.id}>
								<Text as="div" size="sm" data-testid="proposal-title">
									{proposal.title}
								</Text>
								<Text as="div" size="sm">
									Status: {proposal.displayStatus}
								</Text>
								<Text as="div" size="sm" data-testid="vote-count">
									Yes votes: {proposal.votesFor.toString()}
								</Text>
							</Card>
						))}
					</div>
				)}
			</Card>
		</div>
	)
}
