import { Button, Card } from "@stellar/design-system"
import { Link } from "react-router-dom"
import {
	formatUsdcAmount,
	shortenAddress,
	type StoredScholarshipProposal,
} from "../util/scholarshipApplications"
import styles from "../pages/Dao.module.css"

export interface ProposalCardProps {
	proposal: StoredScholarshipProposal
	isHighlighted?: boolean
}

export const ProposalCard = ({ proposal, isHighlighted }: ProposalCardProps) => {
	return (
		<Card key={proposal.id}>
			<article
				id={`proposal-${proposal.proposalId}`}
				className={styles.ProposalCard}
				data-highlighted={isHighlighted}
			>
				<div className={styles.ProposalHeader}>
					<div>
						<p className={styles.ProposalMeta}>
							Proposal #{proposal.proposalId}
						</p>
						<h2>{proposal.programName}</h2>
					</div>
					<div className={styles.BadgeRow}>
						<span className={styles.StatusBadge}>{proposal.status}</span>
						<span className={styles.SourceBadge}>{proposal.source}</span>
					</div>
				</div>

				<div className={styles.DetailGrid}>
					<div>
						<span>Applicant</span>
						<strong>{shortenAddress(proposal.applicant)}</strong>
					</div>
					<div>
						<span>Requested</span>
						<strong>{formatUsdcAmount(proposal.amountUsdc)}</strong>
					</div>
					<div>
						<span>Program start</span>
						<strong>{proposal.startDate}</strong>
					</div>
					<div>
						<span>Submitted</span>
						<strong>
							{new Date(proposal.submittedAt).toLocaleString()}
						</strong>
					</div>
				</div>

				<p className={styles.Description}>{proposal.programDescription}</p>

				<div className={styles.Milestones}>
					{proposal.milestones.map((milestone, index) => (
						<div
							key={`${proposal.id}-milestone-${index}`}
							className={styles.MilestoneItem}
						>
							<strong>Milestone {index + 1}</strong>
							<p>{milestone.description}</p>
							<span>{milestone.dueDate}</span>
						</div>
					))}
				</div>

				<div className={styles.ProposalFooter}>
					<Link to={proposal.programUrl} target="_blank">
						<Button variant="tertiary" size="md">
							View program
						</Button>
					</Link>
					{proposal.txHash && <code>{proposal.txHash}</code>}
				</div>
			</article>
		</Card>
	)
}
