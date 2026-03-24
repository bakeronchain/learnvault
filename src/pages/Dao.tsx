import React from "react"
import { useTranslation } from "react-i18next"

const Dao: React.FC = () => {
	const { t } = useTranslation()

	return (
		<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-16 text-center">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					{t("pages.dao.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.dao.desc")}
				</p>
			</header>

			<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5">
				<div className="text-6xl mb-8">🏛️</div>
				<h2 className="text-3xl font-black mb-4">DAO Structure In Progress</h2>
				<p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed font-medium">
					Governance tokens (LRN) will soon be activated for voting on milestone
					rewards, treasury allocations, and protocol upgrades.
				</p>
				<div className="flex justify-center gap-2">
					<div className="w-12 h-1 bg-brand-cyan/20 rounded-full overflow-hidden">
						<div className="w-1/3 h-full bg-brand-cyan animate-shimmer" />
					</div>
				</div>
			</div>
		</div>
	)
}

export default Dao
