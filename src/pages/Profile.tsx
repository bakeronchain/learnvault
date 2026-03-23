import { Text } from "@stellar/design-system"
import { useTranslation } from "react-i18next"

export default function Profile() {
	const { t } = useTranslation()
	return (
		<div>
			<Text as="h1" size="lg">
				{t("pages.profile.title")}
			</Text>
			<Text as="p" size="md">
				{t("pages.profile.desc")}
			</Text>
		</div>
	)
}
