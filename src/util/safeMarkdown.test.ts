import { describe, expect, it } from "vitest"

import {
	safeMarkdownUrlTransform,
	sanitizeMarkdownContent,
} from "./safeMarkdown"

describe("sanitizeMarkdownContent", () => {
	it("removes script tags in markdown payloads", () => {
		const payload = 'Hello <script>alert("xss")</script> **world**'
		const sanitized = sanitizeMarkdownContent(payload)

		expect(sanitized).not.toContain("<script>")
		expect(sanitized).toContain("**world**")
	})

	it("removes inline event handlers from embedded HTML", () => {
		const payload = '<img src="x" onerror="alert(1)" />'
		const sanitized = sanitizeMarkdownContent(payload)

		expect(sanitized).not.toContain("onerror")
	})

	it("removes iframe-based payloads", () => {
		const payload = '<iframe src="https://attacker.example/xss"></iframe>'
		const sanitized = sanitizeMarkdownContent(payload)

		expect(sanitized).not.toContain("<iframe")
	})
})

describe("safeMarkdownUrlTransform", () => {
	it("rejects javascript protocol URLs", () => {
		expect(safeMarkdownUrlTransform("javascript:alert(1)")).toBe("")
	})

	it("rejects data html protocol URLs", () => {
		expect(safeMarkdownUrlTransform("data:text/html;base64,PHNjcmlwdD4=")).toBe(
			"",
		)
	})

	it("keeps safe https links", () => {
		expect(safeMarkdownUrlTransform("https://example.com/docs")).toBe(
			"https://example.com/docs",
		)
	})
})
