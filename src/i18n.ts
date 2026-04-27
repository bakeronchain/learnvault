import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import fr from "./locales/fr.json"
import sw from "./locales/sw.json"
import ps from "./locales/ps.json"

const resources = {
	en: { translation: en },
	fr: { translation: fr },
	sw: { translation: sw },
	ps: { translation: ps },
}

void i18n
	// detect user language
	// learn more: https://github.com/i18next/i18next-browser-languageDetector
	.use(LanguageDetector)
	// pass the i18n instance to react-i18next.
	.use(initReactI18next)
	// init i18next
	// for all options read: https://www.i18next.com/overview/configuration-options
	.init({
		resources,
		fallbackLng: "en",
		interpolation: {
			escapeValue: false, // not needed for react as it escapes by default
		},
	})

export default i18n
