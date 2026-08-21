import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react"

// Content language is a separate, explicitly stored preference from the UI
// locale (src/i18n.ts) — a learner may want a Swahili interface with English
// lesson text, or the reverse. This file must never import `react-i18next`,
// `../i18n`, or `../hooks/uselocalizeDocumentAttributes` — that import
// boundary is what keeps the two concerns from being silently coupled.
export const SUPPORTED_CONTENT_LANGUAGES = ["en", "es", "fr", "sw"] as const
export type ContentLanguageCode = (typeof SUPPORTED_CONTENT_LANGUAGES)[number]

const STORAGE_KEY = "learnvault:contentLanguage"
const DEFAULT_LANGUAGE: ContentLanguageCode = "en"

function isContentLanguageCode(value: unknown): value is ContentLanguageCode {
	return (
		typeof value === "string" &&
		(SUPPORTED_CONTENT_LANGUAGES as readonly string[]).includes(value)
	)
}

function readStoredLanguage(): ContentLanguageCode {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		return isContentLanguageCode(stored) ? stored : DEFAULT_LANGUAGE
	} catch {
		return DEFAULT_LANGUAGE
	}
}

interface ContentLanguageContextValue {
	contentLanguage: ContentLanguageCode
	setContentLanguage: (language: ContentLanguageCode) => void
}

const ContentLanguageContext = createContext<
	ContentLanguageContextValue | undefined
>(undefined)

export const ContentLanguageProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [contentLanguage, setContentLanguageState] =
		useState<ContentLanguageCode>(readStoredLanguage)

	const setContentLanguage = useCallback((language: ContentLanguageCode) => {
		setContentLanguageState(language)
		try {
			localStorage.setItem(STORAGE_KEY, language)
		} catch {
			// Ignore storage failures (private browsing, quota, etc.) — the
			// in-memory preference for this session still works.
		}
	}, [])

	const value = useMemo(
		() => ({ contentLanguage, setContentLanguage }),
		[contentLanguage, setContentLanguage],
	)

	return (
		<ContentLanguageContext.Provider value={value}>
			{children}
		</ContentLanguageContext.Provider>
	)
}

export function useContentLanguage(): ContentLanguageContextValue {
	const context = useContext(ContentLanguageContext)
	if (!context) {
		throw new Error(
			"useContentLanguage must be used within a ContentLanguageProvider",
		)
	}
	return context
}
