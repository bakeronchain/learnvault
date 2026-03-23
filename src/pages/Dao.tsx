import { Text } from "@stellar/design-system"
import { useTranslation } from "react-i18next"

export default function Dao() {
	const { t } = useTranslation()
	return (
		<div>
			<Text as="h1" size="lg">
				{t("pages.dao.title")}
			</Text>
			<Text as="p" size="md">
				{t("pages.dao.desc")}
			</Text>
		</div>
	)
}
