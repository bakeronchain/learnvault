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

import { ProposalCard } from "../components/ProposalCard"

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
					<span>
						Showing {scopedProposals.length} proposal
						{scopedProposals.length === 1 ? "" : "s"}
						{address ? " for your wallet" : " across local submissions"}
					</span>
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
					{scopedProposals.map((proposal) => (
						<ProposalCard
							key={proposal.id}
							proposal={proposal}
							isHighlighted={proposal.proposalId === highlightedProposalId}
						/>
					))}
				</div>
			)}
		</div>
	)
}

