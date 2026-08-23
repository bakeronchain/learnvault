import React, { useId } from "react"
import { useTranslation } from "react-i18next"
import {
	SUPPORTED_CONTENT_LANGUAGES,
	useContentLanguage,
	type ContentLanguageCode,
} from "../providers/ContentLanguageProvider"

const LANGUAGE_FLAGS: Record<ContentLanguageCode, string> = {
	en: "🇺🇸",
	es: "🇪🇸",
	fr: "🇫🇷",
	sw: "🇰🇪",
}

const LANGUAGE_NAMES: Record<ContentLanguageCode, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	sw: "Kiswahili",
}

// Deliberately its own component reading from useContentLanguage(), not
// react-i18next's i18n.language — content language is independent of the UI
// locale (a Swahili-UI learner may want English lesson text, or the reverse).
export const ContentLanguageSelector: React.FC = () => {
	const { t } = useTranslation()
	const { contentLanguage, setContentLanguage } = useContentLanguage()
	const selectId = useId()

	return (
		<div className="flex items-center gap-2">
			<label
				htmlFor={selectId}
				className="text-xs font-bold uppercase tracking-widest text-white/60"
			>
				{t("contentLanguageLabel", "Lesson language")}
			</label>
			<select
				id={selectId}
				value={contentLanguage}
				onChange={(event) =>
					setContentLanguage(event.target.value as ContentLanguageCode)
				}
				aria-label={t(
					"contentLanguageAriaLabel",
					"Select lesson content language",
				)}
				className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-cyan/40"
			>
				{SUPPORTED_CONTENT_LANGUAGES.map((code) => (
					<option key={code} value={code} className="text-black">
						{LANGUAGE_FLAGS[code]} {LANGUAGE_NAMES[code]}
					</option>
				))}
			</select>
		</div>
	)
}

export default ContentLanguageSelector
