import { Card, Badge, Button } from "@stellar/design-system"
import React from "react"
import { shortenAddress } from "../util/contract"
import ProposalCountdown from "./ProposalCountdown"

export interface ProposalCardProps {
	id: number
	proposerAddress: string
	title: string
	amountUsdc: number
	yesVotes: number
	noVotes: number
	deadlineLedger: number
	currentLedger: number
	status: "active" | "passed" | "rejected" | "executed"
	hasVoted?: boolean
	onVoteYes?: () => void
	onVoteNo?: () => void
}

/**
 * Reusable card for scholarship proposals on the DAO voting page.
 * Shows title, amount, voting progress, status, and buttons.
 */
export const ProposalCard: React.FC<ProposalCardProps> = ({
	proposerAddress,
	title,
	amountUsdc,
	yesVotes,
	noVotes,
	deadlineLedger,
	currentLedger,
	status,
	hasVoted = false,
	onVoteYes,
	onVoteNo,
}) => {
	const totalVotes = yesVotes + noVotes
	const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0
	const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0

	const isClosed = status !== "active" || deadlineLedger <= currentLedger

	const getStatusColor = () => {
		switch (status) {
			case "active":
				return "success"
			case "passed":
				return "success"
			case "rejected":
				return "error"
			case "executed":
				return "primary"
			default:
				return "secondary"
		}
	}

	return (
		<div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-3xl hover:border-brand-cyan/30 transition-all duration-300 overflow-hidden">
			<Card variant="primary" noPadding>
				<div className="p-6 space-y-6">
					{/* Header: Title and Amount */}
					<div className="flex justify-between items-start gap-4">
						<div>
							<h3 className="text-xl font-bold text-white mb-1">{title}</h3>
							<p className="text-sm text-white/50 font-mono">
								{shortenAddress(proposerAddress)}
							</p>
						</div>
						<Badge variant="primary" size="md">
							{`${amountUsdc} USDC`}
						</Badge>
					</div>

					{/* Status and Time */}
					<div className="flex items-center gap-3">
						<Badge variant={getStatusColor() as any} size="sm">
							{status.toUpperCase()}
						</Badge>
						<ProposalCountdown
							deadlineLedger={deadlineLedger}
							currentLedger={currentLedger}
						/>
					</div>

					{/* Progress Bar */}
					<div className="space-y-2">
						<div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
							<span className="text-success">
								YES: {yesVotes} ({yesPercentage.toFixed(0)}%)
							</span>
							<span className="text-error">
								NO: {noVotes} ({noPercentage.toFixed(0)}%)
							</span>
						</div>
						<div className="h-3 w-full bg-white/10 rounded-full overflow-hidden flex">
							<div
								className="h-full bg-success transition-all duration-500"
								style={{ width: `${yesPercentage}%` }}
							/>
							<div
								className="h-full bg-error transition-all duration-500"
								style={{ width: `${noPercentage}%` }}
							/>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 pt-2">
						<div className="flex-1">
							<Button
								variant="success"
								size="sm"
								isFullWidth
								disabled={isClosed || hasVoted}
								onClick={onVoteYes}
							>
								Vote YES
							</Button>
						</div>
						<div className="flex-1">
							<Button
								variant="error"
								size="sm"
								isFullWidth
								disabled={isClosed || hasVoted}
								onClick={onVoteNo}
							>
								Vote NO
							</Button>
						</div>
					</div>

					{hasVoted && (
						<p className="text-[10px] text-center text-white/30 uppercase tracking-[0.2em] font-black">
							You have already cast your vote
						</p>
					)}
				</div>
			</Card>
		</div>
	)
}

export default ProposalCard
