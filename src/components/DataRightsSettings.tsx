import { useCallback, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiFetchJson, buildApiUrl } from "../lib/api"
import { WalletContext } from "../providers/WalletProvider"
import ConfirmDialog from "./ConfirmDialog"

interface ExportJob {
	id: string
	status: "pending" | "processing" | "ready" | "failed"
	downloadUrl?: string
	expiresAt?: string
}

interface DeletionStatus {
	pending: boolean
	eraseAfter?: string
}

interface Challenge {
	transaction: string
	networkPassphrase: string
}

export function DataRightsSettings() {
	const { t } = useTranslation()
	const { address, signTransaction } = useContext(WalletContext)
	const [exportJob, setExportJob] = useState<ExportJob | null>(null)
	const [deletion, setDeletion] = useState<DeletionStatus>({ pending: false })
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refreshDeletion = useCallback(async () => {
		if (!address) return
		try {
			setDeletion(
				await apiFetchJson<DeletionStatus>("/api/me/deletion", { auth: true }),
			)
		} catch {
			setError(t("dataRights.errors.status"))
		}
	}, [address, t])

	useEffect(() => {
		void refreshDeletion()
	}, [refreshDeletion])

	useEffect(() => {
		if (!exportJob || !["pending", "processing"].includes(exportJob.status)) {
			return
		}
		const timer = window.setInterval(() => {
			void apiFetchJson<ExportJob>(`/api/me/export/${exportJob.id}`, {
				auth: true,
			})
				.then(setExportJob)
				.catch(() => setError(t("dataRights.errors.export")))
		}, 3_000)
		return () => window.clearInterval(timer)
	}, [exportJob, t])

	const requestExport = async () => {
		setIsBusy(true)
		setError(null)
		try {
			setExportJob(
				await apiFetchJson<ExportJob>("/api/me/export", {
					method: "POST",
					auth: true,
				}),
			)
		} catch {
			setError(t("dataRights.errors.export"))
		} finally {
			setIsBusy(false)
		}
	}

	const scheduleDeletion = async () => {
		if (!address) return
		setIsBusy(true)
		setError(null)
		try {
			const challenge = await apiFetchJson<Challenge>(
				`/api/auth/challenge?address=${encodeURIComponent(address)}`,
			)
			const signed = await signTransaction(challenge.transaction, {
				address,
				networkPassphrase: challenge.networkPassphrase,
			})
			const response = await apiFetchJson<{ eraseAfter: string }>("/api/me", {
				method: "DELETE",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					confirmation: "DELETE MY ACCOUNT",
					signedTransaction: signed.signedTxXdr,
				}),
			})
			setDeletion({ pending: true, eraseAfter: response.eraseAfter })
			setShowDeleteDialog(false)
		} catch {
			setError(t("dataRights.errors.deletion"))
		} finally {
			setIsBusy(false)
		}
	}

	const cancelDeletion = async () => {
		setIsBusy(true)
		setError(null)
		try {
			await apiFetchJson("/api/me/deletion/cancel", {
				method: "POST",
				auth: true,
			})
			setDeletion({ pending: false })
		} catch {
			setError(t("dataRights.errors.cancel"))
		} finally {
			setIsBusy(false)
		}
	}

	return (
		<section
			className="glass-card mt-12 p-8 rounded-3xl border border-white/10"
			aria-labelledby="your-data-title"
		>
			<h2 id="your-data-title" className="text-2xl font-black mb-3">
				{t("dataRights.title")}
			</h2>
			<p className="text-white/60 mb-6">{t("dataRights.description")}</p>

			{deletion.pending && (
				<div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
					<p className="font-bold text-amber-200">
						{t("dataRights.pending", {
							date: deletion.eraseAfter
								? new Date(deletion.eraseAfter).toLocaleDateString()
								: "",
						})}
					</p>
					<button
						type="button"
						onClick={() => void cancelDeletion()}
						disabled={isBusy}
						className="mt-3 underline text-amber-100"
					>
						{t("dataRights.cancelDeletion")}
					</button>
				</div>
			)}

			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => void requestExport()}
					disabled={!address || isBusy}
					className="px-5 py-3 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-bold disabled:opacity-40"
				>
					{t("dataRights.requestExport")}
				</button>
				{!deletion.pending && (
					<button
						type="button"
						onClick={() => setShowDeleteDialog(true)}
						disabled={!address || isBusy}
						className="px-5 py-3 rounded-xl border border-red-500/30 text-red-300 font-bold disabled:opacity-40"
					>
						{t("dataRights.deleteAccount")}
					</button>
				)}
			</div>

			{exportJob && (
				<p className="mt-4 text-sm text-white/70">
					{t(`dataRights.exportStatus.${exportJob.status}`)}
					{exportJob.downloadUrl && (
						<>
							{" "}
							<a
								href={buildApiUrl(exportJob.downloadUrl)}
								className="text-brand-cyan underline"
							>
								{t("dataRights.download")}
							</a>
						</>
					)}
				</p>
			)}
			{error && (
				<p role="alert" className="mt-4 text-red-300">
					{error}
				</p>
			)}

			{showDeleteDialog && (
				<ConfirmDialog
					title={t("dataRights.dialog.title")}
					description={t("dataRights.dialog.description")}
					confirmLabel={t("dataRights.dialog.confirm")}
					cancelLabel={t("dataRights.dialog.cancel")}
					confirmationPhrase="DELETE MY ACCOUNT"
					onConfirm={() => void scheduleDeletion()}
					onCancel={() => setShowDeleteDialog(false)}
				/>
			)}
		</section>
	)
}
