import { Text } from "@stellar/design-system"
import { useTranslation } from "react-i18next"

export default function Learn() {
	const { t } = useTranslation()
	return (
		<div>
			<Text as="h1" size="lg">
				{t("pages.learn.title")}
			</Text>
			<Text as="p" size="md">
				{t("pages.learn.desc")}
			</Text>
		</div>
	)
}
