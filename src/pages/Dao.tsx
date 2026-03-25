import { Button, Card } from "@stellar/design-system"
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import {
	formatUsdcAmount,
	readStoredScholarshipProposals,
	shortenAddress,
	type StoredScholarshipProposal,
} from "../util/scholarshipApplications"
import styles from "./Dao.module.css"

export default function Dao() {
	const { address } = useWallet()
	const location = useLocation()
	const [proposals, setProposals] = useState<StoredScholarshipProposal[]>([])

	useEffect(() => {
		const sync = () => setProposals(readStoredScholarshipProposals())
		sync()
		window.addEventListener("storage", sync)
		return () => window.removeEventListener("storage", sync)
	}, [])

	const scopedProposals = useMemo(
		() =>
			address
				? proposals.filter((proposal) => proposal.applicant === address)
				: proposals,
		[address, proposals],
	)

	const highlightedProposalId = location.hash.replace("#proposal-", "")

	return (
		<div className={styles.Dao}>
			<section className={styles.Hero}>
				<div>
					<p className={styles.Eyebrow}>Scholarship DAO</p>
					<h1>Funding proposals and community review</h1>
					<p className={styles.HeroText}>
						Eligible learners can submit milestone-based scholarship requests to
						the DAO treasury. Review the latest applications here, then follow
						each proposal through governance and disbursement.
					</p>
				</div>
				<div className={styles.ActionCluster}>
					<Link to="/scholarships/apply">
						<Button variant="primary" size="md">
							Apply for scholarship
						</Button>
					</Link>
					<p className={styles.LiveCount} aria-live="polite">
						Showing {scopedProposals.length} proposal
						{scopedProposals.length === 1 ? "" : "s"}
						{address ? " for your wallet" : " across local submissions"}
					</p>
				</div>
			</section>

			{scopedProposals.length === 0 ? (
				<Card>
					<div className={styles.EmptyState}>
						<h2>No scholarship proposals yet</h2>
						<p>
							Start the multi-step wizard to create a proposal with an
							eligibility check, funding milestones, review step, and
							confirmation view.
						</p>
						<Link to="/scholarships/apply">
							<Button variant="primary" size="md">
								Open application wizard
							</Button>
						</Link>
					</div>
				</Card>
			) : (
				<div className={styles.ProposalList}>
					{scopedProposals.map((proposal) => {
						const isHighlighted = proposal.proposalId === highlightedProposalId
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
											<span className={styles.StatusBadge}>
												{proposal.status}
											</span>
											<span className={styles.SourceBadge}>
												{proposal.source}
											</span>
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

									<p className={styles.Description}>
										{proposal.programDescription}
									</p>

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
										<a
											href={proposal.programUrl}
											target="_blank"
											rel="noreferrer"
										>
											<Button variant="tertiary" size="md">
												View program
											</Button>
										</a>
										{proposal.txHash && (
											<code aria-label={`Transaction hash ${proposal.txHash}`}>
												{proposal.txHash}
											</code>
										)}
									</div>
								</article>
							</Card>
						)
					})}
				</div>
			)}
		</div>
	)
}
