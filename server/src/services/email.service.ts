import { Resend } from "resend"
import {
	templates,
	toPlainText,
	type EmailVariables,
} from "../templates/email-templates"

export interface EmailOptions {
	to: string
	template: string
	subject: string
	data: EmailVariables
}

export class EmailService {
	private readonly from: string
	private readonly resendClient?: Resend

	constructor(apiKey?: string) {
		this.from = process.env.EMAIL_FROM || "notifications@learnvault.xyz"
		const resendApiKey = process.env.RESEND_API_KEY || apiKey
		if (resendApiKey) {
			this.resendClient = new Resend(resendApiKey)
		}
	}

	private async render(
		templateName: string,
		data: EmailVariables,
	): Promise<{ html: string; text: string }> {
		const templateFn = templates[templateName]

		if (!templateFn) {
			console.warn(`[EmailService] Template not found: ${templateName}`)
			return { html: "", text: "" }
		}

		const html = templateFn(data)
		const text = toPlainText(html)

		return { html, text }
	}

	async sendNotification(options: EmailOptions): Promise<boolean> {
		const { html, text } = await this.render(options.template, options.data)

		if (!this.resendClient) {
			console.log(
				`[EmailService] MOCK SEND to ${options.to}: ${options.subject}`,
			)
			console.log(html)
			return true
		}

		try {
			await this.resendClient.emails.send({
				from: this.from,
				to: options.to,
				subject: options.subject,
				html,
				text,
			})

			return true
		} catch (error) {
			console.error("[EmailService] Error sending email:", error)
			return false
		}
	}

	async sendAdminMilestoneNotification(
		scholarName: string,
		courseSlug: string,
		milestoneId: string,
	): Promise<boolean> {
		const adminEmails = process.env.ADMIN_EMAILS

		if (!adminEmails) {
			console.warn(
				"[EmailService] ADMIN_EMAILS not set, skipping notification.",
			)
			return false
		}

		const adminLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin/reviews`

		const body = `New milestone submission from ${scholarName} for course ${courseSlug}, milestone ${milestoneId}. Review it here: ${adminLink}`

		const emails = adminEmails.split(",").map((email) => email.trim())

		let allSent = true
		for (const email of emails) {
			const success = await this.sendNotification({
				to: email,
				subject: `New Milestone Submission`,
				template: "admin-alert",
				data: {
					body,
					adminUrl: adminLink,
					unsubscribeUrl: "#",
				},
			})
			if (!success) allSent = false
		}

		return allSent
	}

	async sendAdminFlagNotification(opts: {
		contentType: string
		contentId: number
		reporter: string
		reason: string
		flagCount: number
	}): Promise<boolean> {
		const adminEmails = process.env.ADMIN_EMAILS

		if (!adminEmails) {
			console.warn(
				"[EmailService] ADMIN_EMAILS not set, skipping flag notification.",
			)
			return false
		}

		const adminUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin`
		const emails = adminEmails.split(",").map((e) => e.trim())

		let allSent = true
		for (const email of emails) {
			const success = await this.sendNotification({
				to: email,
				subject: `[LearnVault] New content flag — ${opts.contentType} #${opts.contentId}`,
				template: "admin-flag-alert",
				data: {
					contentType: opts.contentType,
					contentId: String(opts.contentId),
					reporter: opts.reporter,
					reason: opts.reason,
					flagCount: String(opts.flagCount),
					adminUrl,
					unsubscribeUrl: "#",
				},
			})
			if (!success) allSent = false
		}

		return allSent
	}

	async sendUserWarnNotification(opts: {
		to: string
		contentType: string
		reason?: string
	}): Promise<boolean> {
		return this.sendNotification({
			to: opts.to,
			subject: "[LearnVault] Community guidelines warning",
			template: "user-warn",
			data: {
				contentType: opts.contentType,
				reason: opts.reason ?? "",
				guidelinesUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/guidelines`,
				unsubscribeUrl: "#",
			},
		})
	}
}

export const createEmailService = (apiKey?: string) => new EmailService(apiKey)
