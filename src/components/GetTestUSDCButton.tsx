import { Button, Tooltip } from "@stellar/design-system"
import React, { useState, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet.ts"
import { mintTestUSDC } from "../util/usdc.ts"
import { useToast } from "./Toast/ToastProvider"

interface GetTestUSDCButtonProps {
	amount?: number
}

const GetTestUSDCButton: React.FC<GetTestUSDCButtonProps> = ({
	amount = 1000,
}) => {
	const { showSuccess, showError } = useToast()
	const { t } = useTranslation()
	const [isPending, startTransition] = useTransition()
	const [isTooltipVisible, setIsTooltipVisible] = useState(false)
	const { address, signTransaction } = useWallet()

	if (!address) return null

	const handleGetUSDC = () => {
		startTransition(async () => {
			try {
				const txHash = await mintTestUSDC(
					address,
					async (xdr) => {
						const result = (await signTransaction(xdr)) as {
							signedTransaction?: string
							signedTxXdr?: string
						}
						return {
							signedTransaction:
								result.signedTransaction ?? result.signedTxXdr ?? xdr,
						}
					},
					amount,
				)
				showSuccess(
					t("usdc.mintSuccess", { amount, address: address.slice(0, 8) }) +
						` (Hash: ${txHash.slice(0, 8)}...)`,
				)
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error"
				showError(t("usdc.mintError", { error: errorMessage }))
			}
		})
	}

	return (
		<div
			onMouseEnter={() => setIsTooltipVisible(true)}
			onMouseLeave={() => setIsTooltipVisible(false)}
		>
			<Tooltip
				isVisible={isTooltipVisible}
				isContrast
				title={t("usdc.getTestUSDC")}
				placement="bottom"
				triggerEl={
					<Button
						disabled={isPending}
						onClick={handleGetUSDC}
						variant="secondary"
						size="md"
					>
						{isPending ? t("usdc.minting") : t("usdc.getTestUSDC")}
					</Button>
				}
			>
				<div style={{ width: "15em" }}>{t("usdc.tooltip", { amount })}</div>
			</Tooltip>
		</div>
	)
}

export default GetTestUSDCButton
