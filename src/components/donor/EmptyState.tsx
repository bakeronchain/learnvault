import React from "react"
import { useTranslation } from "react-i18next"

interface EmptyStateProps {
	onBecomeDonor: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onBecomeDonor }) => {
	const { t } = useTranslation()
 
	return (
		<div className="min-h-screen flex items-center justify-center p-12">
			<div className="text-center max-w-2xl">
				<div className="mb-12">
					<div className="inline-block mb-8">
						<div className="text-7xl animate-bounce">💚</div>
					</div>
					<h1 className="text-5xl font-black mb-4 text-gradient">
						{t("pages.donor.supportEducation")}
					</h1>
					<p className="text-white/40 text-xl font-medium leading-relaxed">
						{t("pages.donor.supportDesc")}
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">🎓</div>
						<h3 className="font-black mb-2 text-lg">{t("pages.donor.fundScholarsFeature")}</h3>
						<p className="text-white/40 text-sm font-medium">
							{t("pages.donor.fundScholarsDesc")}
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">🗳️</div>
						<h3 className="font-black mb-2 text-lg">{t("pages.donor.earnVotingPower")}</h3>
						<p className="text-white/40 text-sm font-medium">
							{t("pages.donor.earnVotingDesc")}
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">✓</div>
						<h3 className="font-black mb-2 text-lg">{t("pages.donor.trackImpact")}</h3>
						<p className="text-white/40 text-sm font-medium">
							{t("pages.donor.trackImpactDesc")}
						</p>
					</div>
				</div>

				<div className="glass-card p-12 rounded-[3rem] border border-white/5 mb-12 bg-brand-cyan/5 border-brand-cyan/20">
					<h2 className="text-2xl font-black mb-6">{t("pages.donor.howItWorks")}</h2>
					<div className="space-y-4 text-left">
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								1
							</div>
							<div>
								<h4 className="font-black mb-2">t("pages.donor.step1Title")</h4>
								<p className="text-white/40 font-medium">
									t("pages.donor.step1Desc")
								</p>
							</div>
						</div>
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								2
							</div>
							<div>
								<h4 className="font-black mb-2">t("pages.donor.step2Title")</h4>
								<p className="text-white/40 font-medium">
									 t("pages.donor.step2Desc")
								</p>
							</div>
						</div>
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								3
							</div>
							<div>
								<h4 className="font-black mb-2">t("pages.donor.step3Title")</h4>
								<p className="text-white/40 font-medium">
									t("pages.donor.step3Desc")
								</p>
							</div>
						</div>
					</div>
				</div>

				<button
					onClick={onBecomeDonor}
					className="px-12 py-4 bg-brand-cyan text-black font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-brand-cyan/40 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,210,255,0.5)] transition-all active:scale-95"
				>
					{t("pages.donor.becomeDonor")}
				</button>

				<p className="text-xs text-white/30 mt-8">
					🔐 {t("pages.donor.blockchainSecurity")}
				</p>
			</div>
		</div>
	)
}
