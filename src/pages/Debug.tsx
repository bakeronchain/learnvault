import { ContractExplorer, loadContracts } from "@theahaco/contract-explorer"
import { useTranslation } from "react-i18next"
import { network } from "../contracts/util"
import { useWallet } from "../hooks/useWallet"

// Import contract clients and load them for the Contract Explorer
const contractModules = import.meta.glob("../contracts/*.ts")
const contracts = await loadContracts(contractModules)

const Debugger: React.FC = () => {
	const { address, signTransaction } = useWallet()
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
				<ContractExplorer
					contracts={contracts}
					network={network}
					address={address}
					signTransaction={signTransaction}
				/>
			</div>
		</div>
	)
}

export default Debugger
