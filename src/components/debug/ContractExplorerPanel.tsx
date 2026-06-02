import { ContractExplorer, loadContracts } from "@theahaco/contract-explorer"
import { useEffect, useState } from "react"
import { network } from "../../contracts/util"
import { useWallet } from "../../hooks/useWallet"

const contractModules = import.meta.glob("../../contracts/*.ts")
type Contracts = Awaited<ReturnType<typeof loadContracts>>

const ContractExplorerPanel = () => {
	const { address, signTransaction } = useWallet()
	const [contracts, setContracts] = useState<Contracts | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let mounted = true

		void loadContracts(contractModules)
			.then((loadedContracts) => {
				if (!mounted) return
				setContracts(loadedContracts)
			})
			.catch((loadError) => {
				if (!mounted) return
				console.error("Failed to load contract explorer modules", loadError)
				setError("Contract explorer failed to load.")
			})

		return () => {
			mounted = false
		}
	}, [])

	if (error) {
		return (
			<div className="rounded-[2rem] border border-red-500/20 bg-red-500/8 p-6 text-sm font-medium text-red-100">
				{error}
			</div>
		)
	}

	if (!contracts) {
		return (
			<div className="space-y-4 rounded-[2rem] border border-white/5 bg-white/5 p-6">
				<div className="h-7 w-56 animate-pulse rounded-full bg-white/10" />
				<div className="h-24 animate-pulse rounded-[1.5rem] bg-white/6" />
				<div className="h-48 animate-pulse rounded-[1.5rem] bg-white/6" />
			</div>
		)
	}

	return (
		<ContractExplorer
			contracts={contracts}
			network={network}
			address={address}
			signTransaction={signTransaction}
		/>
	)
}

export default ContractExplorerPanel
