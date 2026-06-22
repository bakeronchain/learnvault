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
	status: "active" | "queued" | "passed" | "rejected" | "executed"
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
			case "queued":
				return "warning"
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
				<div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
					<div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
						<div className="min-w-0 w-full sm:w-auto">
							<h3 className="text-lg sm:text-xl font-bold text-white mb-1 break-words">
								{title}
							</h3>
							<p className="text-xs sm:text-sm text-white/50 font-mono truncate">
								{shortenAddress(proposerAddress)}
							</p>
						</div>
						<Badge variant="primary" size="md">
							{`${amountUsdc} USDC`}
						</Badge>
					</div>

					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<Badge variant={getStatusColor() as any} size="sm">
							{status.toUpperCase()}
						</Badge>
						<ProposalCountdown
							deadlineLedger={deadlineLedger}
							currentLedger={currentLedger}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between text-[10px] sm:text-xs font-bold uppercase tracking-tighter">
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

					<div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
						<div className="flex-1 w-full sm:w-auto">
							<Button
								variant="success"
								size="md"
								isFullWidth
								disabled={isClosed || hasVoted}
								onClick={onVoteYes}
							>
								Vote YES
							</Button>
						</div>
						<div className="flex-1 w-full sm:w-auto">
							<Button
								variant="error"
								size="md"
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
