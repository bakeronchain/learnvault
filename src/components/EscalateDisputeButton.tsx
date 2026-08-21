import { Button } from "@stellar/design-system"
import { useState } from "react"
import { useContractIds } from "../hooks/useContractIds"
import { useWallet } from "../hooks/useWallet"
import { apiFetchJson } from "../lib/api"
import {
	bytesToHex,
	hashEvidenceCid,
	submitOpenDispute,
} from "../lib/milestoneArbitrationContract"
import { useToast } from "./Toast/ToastProvider"

const SCHOLAR_DISPUTE_STAKE_LRN = 500

interface EscalateDisputeButtonProps {
	/** The rejected milestone's sequence number (arbitration's `milestoneId`). */
	milestoneId: number
	/** When the rejection happened -- bounds the dispute window on-chain. */
	rejectedAt: string | null
}

export default function EscalateDisputeButton({
	milestoneId,
	rejectedAt,
}: EscalateDisputeButtonProps) {
	const { address, signTransaction } = useWallet()
	const { milestoneArbitration } = useContractIds()
	const { showSuccess, showError, showInfo } = useToast()
	const [isOpen, setIsOpen] = useState(false)
	const [proposalId, setProposalId] = useState("")
	const [file, setFile] = useState<File | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [lastTxHash, setLastTxHash] = useState<string | null>(null)

	if (!milestoneArbitration) {
		return null
	}

	const handleEscalate = async () => {
		if (!address || !signTransaction) {
			showError("Connect your wallet first.")
			return
		}
		const parsedProposalId = Number(proposalId)
		if (!Number.isFinite(parsedProposalId) || parsedProposalId <= 0) {
			showError("Enter the proposal ID this milestone belongs to.")
			return
		}
		if (!file) {
			showError("Attach evidence supporting your dispute before escalating.")
			return
		}

		setIsSubmitting(true)
		try {
			showInfo("Uploading evidence to IPFS...")
			const formData = new FormData()
			formData.append("file", file)
			const uploadResult = await apiFetchJson<{ cid: string }>("/api/upload", {
				method: "POST",
				auth: true,
				body: formData,
			})

			await apiFetchJson("/api/disputes/pending-evidence", {
				method: "POST",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					proposalId: parsedProposalId,
					milestoneId,
					evidenceIpfsCid: uploadResult.cid,
				}),
			})

			const evidenceHash = await hashEvidenceCid(uploadResult.cid)
			const rejectedAtSeconds = BigInt(
				Math.floor(new Date(rejectedAt ?? Date.now()).getTime() / 1000),
			)

			showInfo(
				`Waiting for wallet approval to stake ${SCHOLAR_DISPUTE_STAKE_LRN} LRN...`,
			)
			const txHash = await submitOpenDispute({
				contractId: milestoneArbitration,
				scholarAddress: address,
				proposalId: parsedProposalId,
				milestoneId,
				evidenceHash,
				rejectedAtSeconds,
				signTransaction,
			})

			setLastTxHash(txHash)
			showSuccess(
				`Dispute opened. A panel of jurors will be drawn to review evidence hash ${bytesToHex(evidenceHash).slice(0, 10)}...`,
			)
		} catch (err) {
			showError(
				err instanceof Error
					? err.message
					: "Failed to escalate to arbitration.",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (!isOpen) {
		return (
			<Button
				type="button"
				variant="secondary"
				size="sm"
				onClick={() => setIsOpen(true)}
			>
				Escalate to arbitration
			</Button>
		)
	}

	return (
		<div className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
			<p className="text-xs text-white/70">
				Escalating requires staking{" "}
				<strong>{SCHOLAR_DISPUTE_STAKE_LRN} LRN</strong>, which is forfeited if
				a juror panel upholds this rejection. A panel of staked jurors will
				review your evidence and vote; the outcome directly authorizes (or
				denies) release of the escrow tranche.
			</p>
			<label className="block space-y-1 text-xs text-white/80">
				<span className="font-semibold text-white">Proposal ID</span>
				<input
					value={proposalId}
					onChange={(e) => setProposalId(e.target.value)}
					inputMode="numeric"
					placeholder="e.g. 12"
					className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-brand-cyan/50"
				/>
			</label>
			<label className="block space-y-1 text-xs text-white/80">
				<span className="font-semibold text-white">Evidence file</span>
				<input
					type="file"
					onChange={(e) => setFile(e.target.files?.[0] ?? null)}
					className="w-full text-xs text-white/70"
				/>
			</label>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="primary"
					size="sm"
					disabled={isSubmitting}
					onClick={() => void handleEscalate()}
				>
					{isSubmitting
						? "Submitting..."
						: `Stake ${SCHOLAR_DISPUTE_STAKE_LRN} LRN & escalate`}
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={() => setIsOpen(false)}
				>
					Cancel
				</Button>
			</div>
			{lastTxHash && (
				<p className="break-all text-xs text-emerald-300">
					Dispute tx: {lastTxHash}
				</p>
			)}
		</div>
	)
}
