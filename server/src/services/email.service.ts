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
		milestoneId: string
	): Promise<boolean> {
		const adminEmail = process.env.ADMIN_EMAIL;

		if (!adminEmail) {
			console.warn("[EmailService] ADMIN_EMAIL not set, skipping notification.");
			return false;
		}

		const adminLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/reviews`;

		return this.sendNotification({
			to: adminEmail,
			subject: `New Submission: ${scholarName}`,
			template: "admin-alert",
			data: {
				body: `Scholar <strong>${scholarName}</strong> has submitted a report for <strong>${courseSlug}</strong> (Milestone ${milestoneId}).`,
				adminUrl: adminLink,
				unsubscribeUrl: "#"
			}
		});
	}
}

export const createEmailService = (apiKey: string) => new EmailService(apiKey)

