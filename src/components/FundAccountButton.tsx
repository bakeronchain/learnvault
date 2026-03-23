import { Button, Tooltip } from "@stellar/design-system"
import React, { useState, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { useNotification } from "../hooks/useNotification.ts"
import { useWallet } from "../hooks/useWallet.ts"
import { getFriendbotUrl } from "../util/friendbot"

const FundAccountButton: React.FC = () => {
	const { addNotification } = useNotification()
	const { t } = useTranslation()
	const [isPending, startTransition] = useTransition()
	const [isTooltipVisible, setIsTooltipVisible] = useState(false)
	const { address } = useWallet()

	if (!address) return null

	const handleFundAccount = () => {
		startTransition(async () => {
			try {
				const response = await fetch(getFriendbotUrl(address))

				if (response.ok) {
					addNotification(t("connect.funded"), "success")
				} else {
					const body: unknown = await response.json()
					if (
						body !== null &&
						typeof body === "object" &&
						"detail" in body &&
						typeof body.detail === "string"
					) {
						addNotification(
							t("connect.fundErrorDetail", { detail: body.detail }),
							"error",
						)
					} else {
						addNotification(t("connect.fundErrorUnknown"), "error")
					}
				}
			} catch {
				addNotification(t("connect.fundErrorRetry"), "error")
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
				title={t("connect.fund")}
				placement="bottom"
				triggerEl={
					<Button
						disabled={isPending}
						onClick={handleFundAccount}
						variant="primary"
						size="md"
					>
						{t("connect.fund")}
					</Button>
				}
			>
				<div style={{ width: "13em" }}>{t("connect.alreadyFunded")}</div>
			</Tooltip>
		</div>
	)
}

export default FundAccountButton
