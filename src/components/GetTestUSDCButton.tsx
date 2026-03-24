import { Button, Tooltip } from "@stellar/design-system"
import React, { useState, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { useNotification } from "../hooks/useNotification.ts"
import { useWallet } from "../hooks/useWallet.ts"
import { mintTestUSDC } from "../util/usdc.ts"

interface GetTestUSDCButtonProps {
	amount?: number
}

const GetTestUSDCButton: React.FC<GetTestUSDCButtonProps> = ({
	amount = 1000,
}) => {
	const { addNotification } = useNotification()
	const { t } = useTranslation()
	const [isPending, startTransition] = useTransition()
	const [isTooltipVisible, setIsTooltipVisible] = useState(false)
	const { address } = useWallet()

	if (!address) return null

	const handleGetUSDC = () => {
		startTransition(async () => {
			try {
				await mintTestUSDC(address, amount)
				addNotification(
					t("usdc.mintSuccess", { amount, address: address.slice(0, 8) }),
					"success",
				)
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error"
				addNotification(
					t("usdc.mintError", { error: errorMessage }),
					"error",
				)
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
				<div style={{ width: "15em" }}>
					{t("usdc.tooltip", { amount })}
				</div>
			</Tooltip>
		</div>
	)
}

export default GetTestUSDCButton
