import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react"
import { useCreateBounty } from "../hooks/useBounties"
import { useWallet } from "../hooks/useWallet"
import { useToast } from "../components/Toast/ToastProvider"
import { Link } from "react-router-dom"

export default function CreateBounty() {
	const navigate = useNavigate()
	const { address, isConnected, connect } = useWallet()
	const { showSuccess, showError } = useToast()
	const createBounty = useCreateBounty()

	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [rewardUsdc, setRewardUsdc] = useState("")
	const [escrowTx, setEscrowTx] = useState("")
	const [claimDurationHours, setClaimDurationHours] = useState("72")
	const [tagInput, setTagInput] = useState("")
	const [skillTags, setSkillTags] = useState<string[]>([])
	const [errors, setErrors] = useState<Record<string, string>>({})

	const addTag = () => {
		const tag = tagInput.trim().toLowerCase()
		if (tag && !skillTags.includes(tag) && skillTags.length < 10) {
			setSkillTags([...skillTags, tag])
			setTagInput("")
		}
	}

	const removeTag = (tag: string) => {
		setSkillTags(skillTags.filter((t) => t !== tag))
	}

	const validate = (): boolean => {
		const errs: Record<string, string> = {}
		if (title.trim().length < 5) errs.title = "Title must be at least 5 characters"
		if (title.trim().length > 200) errs.title = "Title must be at most 200 characters"
		if (description.trim().length < 20) errs.description = "Description must be at least 20 characters"
		if (description.trim().length > 5000) errs.description = "Description must be at most 5000 characters"
		const reward = Number.parseFloat(rewardUsdc)
		if (!Number.isFinite(reward) || reward <= 0) errs.rewardUsdc = "Enter a valid positive reward amount"
		if (escrowTx.trim().length === 0) errs.escrowTx = "Escrow transaction hash is required"
		const hours = Number.parseInt(claimDurationHours, 10)
		if (!Number.isFinite(hours) || hours <= 0) errs.claimDurationHours = "Enter a valid duration"
		setErrors(errs)
		return Object.keys(errs).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate()) return

		try {
			const result = await createBounty.mutateAsync({
				title: title.trim(),
				description: description.trim(),
				skillTags,
				rewardUsdc: rewardUsdc.trim(),
				escrowTx: escrowTx.trim(),
				claimDurationHours: Number.parseInt(claimDurationHours, 10),
			})
			showSuccess("Bounty created successfully!")
			navigate(`/bounties/${result.bounty.id}`)
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to create bounty")
		}
	}

	if (!isConnected) {
		return (
			<div className="mx-auto max-w-3xl px-6 py-12 sm:px-12">
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-8 text-center">
					<h2 className="text-xl font-bold text-white mb-3">Connect Your Wallet</h2>
					<p className="text-sm text-white/50 mb-6">
						You need a connected wallet to create a bounty.
					</p>
					<button
						onClick={connect}
						className="px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all text-sm"
					>
						Connect Wallet
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-3xl px-6 py-12 sm:px-12">
			<Link
				to="/bounties"
				className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to bounties
			</Link>

			<h1 className="text-2xl font-black text-white mb-2">Create a Bounty</h1>
			<p className="text-sm text-white/50 mb-8">
				Fund a coding task through escrow. Learners will claim and submit work for USDC + LRN rewards.
			</p>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Title */}
				<div>
					<label className="block text-xs text-white/50 mb-1.5 font-medium">Title</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="e.g. Build wallet analytics component"
						className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
					/>
					{errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
				</div>

				{/* Description */}
				<div>
					<label className="block text-xs text-white/50 mb-1.5 font-medium">Description</label>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Describe the task requirements, scope, and expected deliverables..."
						rows={6}
						className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors resize-none"
					/>
					{errors.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
				</div>

				{/* Skill tags */}
				<div>
					<label className="block text-xs text-white/50 mb-1.5 font-medium">Skill Tags</label>
					<div className="flex gap-2 mb-2">
						<input
							type="text"
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault()
									addTag()
								}
							}}
							placeholder="Type a skill and press Enter"
							className="flex-1 px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
						/>
						<button
							type="button"
							onClick={addTag}
							className="px-3 py-2.5 glass rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
						>
							<Plus className="h-4 w-4" />
						</button>
					</div>
					{skillTags.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{skillTags.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-white/60"
								>
									{tag}
									<button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
					)}
				</div>

				{/* Reward & escrow */}
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-xs text-white/50 mb-1.5 font-medium">Reward (USDC)</label>
						<input
							type="number"
							step="0.01"
							min="0.01"
							value={rewardUsdc}
							onChange={(e) => setRewardUsdc(e.target.value)}
							placeholder="250"
							className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
						/>
						{errors.rewardUsdc && <p className="text-xs text-red-400 mt-1">{errors.rewardUsdc}</p>}
					</div>
					<div>
						<label className="block text-xs text-white/50 mb-1.5 font-medium">Claim Duration (hours)</label>
						<input
							type="number"
							min="1"
							value={claimDurationHours}
							onChange={(e) => setClaimDurationHours(e.target.value)}
							className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
						/>
						{errors.claimDurationHours && <p className="text-xs text-red-400 mt-1">{errors.claimDurationHours}</p>}
					</div>
				</div>

				{/* Escrow TX */}
				<div>
					<label className="block text-xs text-white/50 mb-1.5 font-medium">Escrow Transaction Hash</label>
					<input
						type="text"
						value={escrowTx}
						onChange={(e) => setEscrowTx(e.target.value)}
						placeholder="Transaction hash from escrow funding"
						className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
					/>
					{errors.escrowTx && <p className="text-xs text-red-400 mt-1">{errors.escrowTx}</p>}
					<p className="text-xs text-white/30 mt-1">
						Fund the milestone escrow contract first, then paste the transaction hash here for server-side verification.
					</p>
				</div>

				{/* Submit */}
				<div className="flex items-center gap-4 pt-2">
					<button
						type="submit"
						disabled={createBounty.isPending}
						className="inline-flex items-center gap-2 px-8 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-sm"
					>
						{createBounty.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Plus className="h-4 w-4" />
						)}
						Create Bounty
					</button>
					<span className="text-xs text-white/30">
					 Connected as {address?.slice(0, 4)}...{address?.slice(-4)}
					</span>
				</div>
			</form>
	 </div>
	)
}
