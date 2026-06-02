import sgMail from "@sendgrid/mail"
import { Resend } from "resend"
import nodemailer from "nodemailer"
import { logger } from "../lib/logger"
import {
	templates,
	toPlainText,
	type EmailVariables,
} from "../templates/email-templates"

const log = logger.child({ module: "email" })

export interface EmailOptions {
	to: string
	template: string
	subject: string
	data: EmailVariables
}

export class EmailService {
	private readonly from: string
	private readonly resendClient?: Resend
	private readonly transporter?:
		| ReturnType<typeof nodemailer.createTransport>
		| undefined
	private readonly useSendGrid: boolean
	private readonly sendGridApiKey?: string
	private readonly smtpConfigured: boolean

	constructor(sendGridApiKey?: string) {
		this.from = process.env.EMAIL_FROM || "notifications@learnvault.xyz"
		const resendApiKey = process.env.RESEND_API_KEY
		const resolvedSendGridApiKey = process.env.EMAIL_API_KEY || sendGridApiKey

		this.useSendGrid = Boolean(resolvedSendGridApiKey)
		this.sendGridApiKey = resolvedSendGridApiKey || undefined
		this.smtpConfigured = Boolean(
			process.env.SMTP_HOST &&
				process.env.SMTP_PORT &&
				process.env.SMTP_USER &&
				process.env.SMTP_PASS &&
				process.env.SMTP_FROM,
		)

		if (resendApiKey) {
			this.resendClient = new Resend(resendApiKey)
		} else if (this.useSendGrid && this.sendGridApiKey) {
			// SendGrid SDK uses a module singleton, so we set the API key once.
			sgMail.setApiKey(this.sendGridApiKey)
		} else if (this.smtpConfigured) {
			this.transporter = nodemailer.createTransport({
				host: process.env.SMTP_HOST,
				port: Number(process.env.SMTP_PORT),
				secure: false,
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS,
				},
			})
		}
	}

	private isValidEmail(to: string): boolean {
		// Simple sanity check; avoids pulling in another dependency.
		// Good enough to reject obviously invalid addresses.
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
	}

	private async render(
		templateName: string,
		data: EmailVariables,
	): Promise<{ html: string; text: string }> {
		const templateFn = templates[templateName]

		if (!templateFn) {
			log.warn({ templateName }, "Email template not found")
			return { html: "", text: "" }
		}

		const html = templateFn(data)
		const text = toPlainText(html)

		return { html, text }
	}

	async sendNotification(options: EmailOptions): Promise<boolean> {
		if (!this.isValidEmail(options.to)) {
			log.warn({ to: options.to }, "Invalid email address rejected")
			return false
		}

		const { html, text } = await this.render(options.template, options.data)

		try {
			if (this.resendClient) {
				await this.resendClient.emails.send({
					from: this.from,
					to: options.to,
					subject: options.subject,
					html,
					text,
				})
				return true
			}

			if (this.useSendGrid && this.sendGridApiKey) {
				await sgMail.send({
					from: this.from,
					to: options.to,
					subject: options.subject,
					html,
					text,
				})
				return true
			}

			if (this.transporter) {
				await this.transporter.sendMail({
					from: this.from,
					to: options.to,
					subject: options.subject,
					html,
					text,
				})
				return true
			}

			// If no provider is configured, we don't want to crash production flows.
			// The caller can treat this as a best-effort notification.
			log.debug({ subject: options.subject }, "MOCK email send")
			return true
		} catch (error) {
			log.error({ err: error }, "Error sending email")
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
			log.warn("ADMIN_EMAILS not set, skipping admin notification")
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

	async sendAdminFlagNotification(
		contentType: string,
		contentId: number,
		reason: string,
		reporterAddress: string,
	): Promise<boolean> {
		const adminEmails = process.env.ADMIN_EMAILS

		if (!adminEmails) {
			log.warn("ADMIN_EMAILS not set, skipping admin flag notification")
			return false
		}

		const adminLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin/moderation`
		const body = `Content flagged: ${contentType} #${contentId}\nReporter: ${reporterAddress}\nReason: ${reason}\nReview: ${adminLink}`

		const emails = adminEmails.split(",").map((email) => email.trim())

		let allSent = true
		for (const email of emails) {
			const success = await this.sendNotification({
				to: email,
				subject: "Content Flagged",
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

export const createEmailService = (apiKey?: string) => new EmailService(apiKey)
