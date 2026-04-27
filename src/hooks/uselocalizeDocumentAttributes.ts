import { useEffect } from "react"
import { useTranslation } from "react-i18next"

/**
 * Synchronizes the document's <html> lang and dir attributes with the
 * active i18next locale. This ensures correct text direction (LTR/RTL)
 * for accessibility, SEO, and browser rendering.
 *
 * Also localizes the document title if a translation key "app_title"
 * is defined in the active locale.
 */
export function useLocalizeDocumentAttributes() {
	const { t, i18n } = useTranslation()

	useEffect(() => {
		if (i18n.resolvedLanguage) {
			document.documentElement.lang = i18n.resolvedLanguage
			document.documentElement.dir = i18n.dir(i18n.resolvedLanguage)
		}

		// Localize document title when translation key exists
		try {
			const title = t("app_title", { defaultValue: "LearnVault" })
			if (title && title !== "LearnVault") {
				document.title = title
			}
		} catch {
			// Keep default title if translation is missing
		}
	}, [i18n, i18n.resolvedLanguage, t])
}