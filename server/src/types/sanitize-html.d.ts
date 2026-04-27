declare module "sanitize-html" {
	interface SanitizeHtmlOptions {
		allowedTags?: string[]
		allowedAttributes?: Record<string, string[]>
	}

	export default function sanitizeHtml(
		input: string,
		options?: SanitizeHtmlOptions,
	): string
}
