import { useWallet } from "../hooks/useWallet"
import ConnectAccount from "./ConnectAccount"

// If wallet is not connected, show a prompt instead of the page content
const ConnectWalletGuard = ({ children }) => {
	const { isConnected } = useWallet() // existing hook
	if (!isConnected) {
		return (
			<Card>
				<p>Please connect your wallet to continue.</p>
				<ConnectAccount />
			</Card>
		)
	}
	return children
}
