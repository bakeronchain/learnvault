import React from "react"
import ReactMarkdown from "react-markdown"

import {
	SAFE_MARKDOWN_ELEMENTS,
	safeMarkdownUrlTransform,
	sanitizeMarkdownContent,
} from "../util/safeMarkdown"

interface SafeMarkdownProps {
	content: string
}

const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content }) => {
	const sanitizedContent = sanitizeMarkdownContent(content)

	return (
		<ReactMarkdown
			skipHtml
			remarkRehypeOptions={{ allowDangerousHtml: false }}
			allowedElements={[...SAFE_MARKDOWN_ELEMENTS]}
			unwrapDisallowed
			urlTransform={safeMarkdownUrlTransform}
		>
			{sanitizedContent}
		</ReactMarkdown>
	)
}

export default SafeMarkdown
