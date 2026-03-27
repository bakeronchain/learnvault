import sgMail from "@sendgrid/mail"
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
	constructor(apiKey: string) {
		if (apiKey) {
			sgMail.setApiKey(apiKey)
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
		if (!process.env.EMAIL_API_KEY) {
			console.log(
				`[EmailService] MOCK SEND to ${options.to}: ${options.subject}`,
			)
			return true
		}

		try {
			const { html, text } = await this.render(options.template, options.data)

			await sgMail.send({
				to: options.to,
				from: process.env.EMAIL_FROM || "notifications@learnvault.xyz",
				subject: options.subject,
				text,
				html,
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
}

export const createEmailService = (apiKey: string) => new EmailService(apiKey)
