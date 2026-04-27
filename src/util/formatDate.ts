import { format } from "date-fns"
import { enUS, es, fr, sw } from "date-fns/locale"
import i18n from "./i18n"

/**
 * Maps i18next language codes to date-fns locales for locale-aware formatting.
 */
const localeMap: Record<string, Locale> = {
	en: enUS,
	es: es,
	fr: fr,
	sw: sw,
}

/**
 * Returns the current date-fns locale based on the active i18n language.
 * Falls back to enUS if the language is not supported.
 */
export function getCurrentDateLocale(): Locale {
	const lang = i18n.language?.split("-")[0] ?? "en"
	return localeMap[lang] ?? enUS
}

/**
 * Formats a date using the current i18n locale.
 * @param date - The date to format
 * @param dateFormat - The date-fns format string (default: "PPP")
 * @returns The formatted date string
 */
export function formatDate(date: Date | number, dateFormat = "PPP"): string {
	return format(date, dateFormat, { locale: getCurrentDateLocale() })
}
