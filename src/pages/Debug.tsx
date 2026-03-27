import { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
const ContractExplorerPanel = lazy(
	() => import("../components/debug/ContractExplorerPanel"),
)

const Debugger: React.FC = () => {
	const { t } = useTranslation()

	return (
		<div className="p-12 max-w-7xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-12">
				<h1 className="text-5xl font-black mb-4 tracking-tighter text-gradient">
					{t("nav.debug")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t(
						"pages.debug.desc",
						"Low-level interaction with indexed Soroban smart contracts.",
					)}
				</p>
			</header>

			<div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden backdrop-blur-3xl shadow-2xl">
				<div className="absolute top-0 right-0 p-8 opacity-5">
					<div className="text-8xl font-black tracking-tighter">DEBUG</div>
				</div>
				<Suspense
					fallback={
						<div className="space-y-5 rounded-[2rem] border border-white/5 bg-white/5 p-8">
							<div className="h-8 w-48 animate-pulse rounded-full bg-white/10" />
							<div className="h-24 animate-pulse rounded-[1.5rem] bg-white/6" />
							<div className="h-56 animate-pulse rounded-[1.5rem] bg-white/6" />
						</div>
					}
				>
					<ContractExplorerPanel />
				</Suspense>
			</div>
		</div>
	)
}

export default Debugger
