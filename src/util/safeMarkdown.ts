import DOMPurify from "../vendor/purify.es.mjs"

export const SAFE_MARKDOWN_ELEMENTS = [
	"p",
	"br",
	"strong",
	"em",
	"del",
	"blockquote",
	"code",
	"pre",
	"ul",
	"ol",
	"li",
	"a",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
] as const

const SAFE_HTML_TAGS = [
	"p",
	"br",
	"strong",
	"em",
	"del",
	"blockquote",
	"code",
	"pre",
	"ul",
	"ol",
	"li",
	"a",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
]

const SAFE_HTML_ATTRIBUTES = ["href", "title", "target", "rel"]

const DANGEROUS_BLOCK_TAGS =
	/<(script|style|iframe|object|embed|form|button)[^>]*>[\s\S]*?<\/\1>/gi
const DANGEROUS_INLINE_TAGS = /<\/?(script|style|iframe|object|embed|form|input|button)[^>]*>/gi
const EVENT_HANDLER_ATTRIBUTES = /\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi

const fallbackSanitize = (content: string) =>
	content
		.replace(DANGEROUS_BLOCK_TAGS, "")
		.replace(DANGEROUS_INLINE_TAGS, "")
		.replace(EVENT_HANDLER_ATTRIBUTES, "")

export const sanitizeMarkdownContent = (content: string) => {
	if (typeof window === "undefined" || !DOMPurify.isSupported) {
		return fallbackSanitize(content)
	}

	return DOMPurify.sanitize(content, {
		ALLOWED_TAGS: SAFE_HTML_TAGS,
		ALLOWED_ATTR: SAFE_HTML_ATTRIBUTES,
		ALLOW_DATA_ATTR: false,
		FORBID_ATTR: ["style"],
	})
}

const DANGEROUS_PROTOCOLS = /^(?:javascript|vbscript|data:text\/html)/i

export const safeMarkdownUrlTransform = (url: string) => {
	const trimmed = url.trim()
	if (!trimmed) return ""
	return DANGEROUS_PROTOCOLS.test(trimmed) ? "" : trimmed
}
