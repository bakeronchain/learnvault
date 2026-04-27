import React from "react"
import { useTranslation } from "react-i18next"
import { type Scholar } from "../../hooks/useDonor"
import AddressDisplay from "../AddressDisplay"

interface ScholarsFundedProps {
	scholars: Scholar[]
}

export const ScholarsFunded: React.FC<ScholarsFundedProps> = ({ scholars }) => {
	const { t } = useTranslation()

	const getStatusColor = (status: string) =>
		status === "completed" ? "text-brand-emerald" : "text-brand-cyan"

	const getStatusBg = (status: string) =>
		status === "completed"
			? "bg-brand-emerald/10 border-brand-emerald/30"
			: "bg-brand-cyan/10 border-brand-cyan/30"

	return (
		<section className="mb-20">
			<div className="flex items-center gap-4 mb-12">
				<h2 className="text-2xl font-black tracking-tight">{t("pages.donor.scholarsIFunded")}</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			{scholars.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					{scholars.map((scholar) => (
						<div key={scholar.id}
							className="glass-card p-10 rounded-[3rem] border border-white/5 hover:border-white/20 transition-all hover:-translate-y-2 flex flex-col">
							<div className="flex items-start justify-between mb-6">
								<div>
									<h3 className="text-xl font-black mb-2">{scholar.name}</h3>
									<AddressDisplay
										address={scholar.id}
										addressClassName="text-xs text-white/40 uppercase font-black tracking-widest"
										showCopyButton={false}
									/>
								</div>
								<span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full border ${getStatusBg(scholar.status)} ${getStatusColor(scholar.status)}`}>
									{scholar.status}
								</span>
							</div>

							<div className="mb-6">
								<p className="text-sm font-black mb-1">${scholar.proposalAmount.toLocaleString()}</p>
								<p className="text-xs text-white/40 font-medium">{t("pages.donor.totalProposalAmount")}</p>
							</div>

							<div className="h-px bg-white/5 mb-6" />

							<div className="mb-8">
								<div className="flex items-center justify-between mb-3">
									<p className="text-xs text-white/40 uppercase font-black tracking-widest">
										{t("pages.donor.myContribution")}
									</p>
									<span className="text-sm font-black text-brand-cyan">
										{scholar.fundedPercentage.toFixed(0)}%
									</span>
								</div>
								<div className="h-2 bg-white/5 rounded-full overflow-hidden">
									<div className="h-full bg-brand-cyan/60 shadow-[0_0_10px_rgba(0,210,255,0.4)]"
										style={{ width: `${scholar.fundedPercentage}%` }} />
								</div>
							</div>

							<div className="mt-auto">
								<div className="flex items-center justify-between mb-3">
									<p className="text-xs text-white/40 uppercase font-black tracking-widest">
										{t("pages.donor.progress")}
									</p>
									<span className="text-sm font-black text-brand-emerald">
										{scholar.progressPercentage.toFixed(0)}%
									</span>
								</div>
								<div className="h-2 bg-white/5 rounded-full overflow-hidden">
									<div className="h-full bg-brand-emerald/60 shadow-[0_0_10px_rgba(76,175,80,0.4)]"
										style={{ width: `${scholar.progressPercentage}%` }} />
								</div>
								<p className="text-[10px] text-white/30 mt-3">
									{scholar.progressPercentage === 100
										? t("pages.donor.proposalComplete")
										: t("pages.donor.proposalProgress", { percent: scholar.progressPercentage })}
								</p>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center">
					<div className="text-5xl mb-4">🎓</div>
					<p className="text-white/40 font-medium mb-4">{t("pages.donor.noScholars")}</p>
					<p className="text-xs text-white/30">{t("pages.donor.noScholarsDesc")}</p>
				</div>
			)}
		</section>
	)
}