import { Text } from "@stellar/design-system"
import { useTranslation } from "react-i18next"

export default function Leaderboard() {
	const { t } = useTranslation()
	return (
		<div>
			<Text as="h1" size="lg">
				{t("pages.leaderboard.title")}
			</Text>
			<Text as="p" size="md">
				{t("pages.leaderboard.desc")}
			</Text>
		</div>
	)
}
