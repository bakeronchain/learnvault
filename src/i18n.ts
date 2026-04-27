import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import fr from "./locales/fr.json"
import sw from "./locales/sw.json"

// Pseudo-locale is loaded lazily only when explicitly requested (dev/CI only).
// It is never shipped in the production bundle.
const loadPseudo = async () => {
	if (import.meta.env.DEV || import.meta.env.VITE_PSEUDO_LOCALE === "true") {
		try {
			const pseudo = await import("./locales/pseudo.json")
			return pseudo.default
		} catch {
			return null
		}
	}
	return null
}

const resources: Record<string, { translation: unknown }> = {
	en: { translation: en },
	fr: { translation: fr },
	sw: { translation: sw },
}

// Attach pseudo-locale in dev and CI environments
const pseudoTranslation = await loadPseudo()
if (pseudoTranslation) {
	resources["pseudo"] = { translation: pseudoTranslation }
}

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: "en",
		interpolation: {
			escapeValue: false,
		},
		// In development, warn on missing keys so contributors catch gaps early
		...(import.meta.env.DEV && {
			saveMissing: true,
			missingKeyHandler: (lngs, ns, key) => {
				console.warn(`[i18n] Missing key: "${key}" for languages: ${lngs.join(", ")}`)
			},
		}),
	})

export default i18n