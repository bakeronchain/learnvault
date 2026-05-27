// Tests for EmailService template rendering + delivery behaviors.
// Providers (SendGrid / Resend / Nodemailer) are mocked so these tests are hermetic.

const resendSendMock = jest.fn()
jest.mock("resend", () => ({
	Resend: jest.fn().mockImplementation(() => ({
		emails: {
			send: resendSendMock,
		},
	})),
}))

const sendGridSetApiKeyMock = jest.fn()
const sendGridSendMock = jest.fn()
jest.mock("@sendgrid/mail", () => ({
	__esModule: true,
	default: {
		setApiKey: sendGridSetApiKeyMock,
		send: sendGridSendMock,
	},
}))

const nodemailerCreateTransportMock = jest.fn()
const nodemailerSendMailMock = jest.fn()
jest.mock("nodemailer", () => ({
	__esModule: true,
	default: {
		createTransport: nodemailerCreateTransportMock.mockReturnValue({
			sendMail: nodemailerSendMailMock,
		}),
	},
}))

import { createEmailService } from "../services/email.service"

const VALID_TO = "alice@example.com"
const INVALID_TO = "not-an-email"

const renderData = {
	name: "Alice",
	courseTitle: "Stellar Basics",
	milestoneTitle: "Milestone 1",
	milestoneNumber: "1",
	reward: "10",
	dashboardUrl: "https://example.com/dashboard",
	unsubscribeUrl: "#",
	rejectionReason: "Need more evidence",
	milestoneUrl: "https://example.com/milestones/1",
	proposalTitle: "DeFi Foundations",
	proposalUrl: "https://example.com/proposal",
}

describe("EmailService", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		resendSendMock.mockReset()
		sendGridSendMock.mockReset()
		nodemailerSendMailMock.mockReset()
		delete process.env.RESEND_API_KEY
		delete process.env.EMAIL_API_KEY
		delete process.env.SMTP_HOST
		delete process.env.SMTP_PORT
		delete process.env.SMTP_USER
		delete process.env.SMTP_PASS
		delete process.env.SMTP_FROM
		process.env.EMAIL_FROM = "notifications@learnvault.xyz"
	})

	it("milestone approval email renders correctly (HTML)", async () => {
		process.env.RESEND_API_KEY = "re_test"

		resendSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Milestone Approved ",
			template: "milestone-approved-admin",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(resendSendMock).toHaveBeenCalledTimes(1)

		const payload = resendSendMock.mock.calls[0][0]
		expect(payload.to).toBe(VALID_TO)
		expect(payload.subject).toBe("Milestone Approved ")
		expect(payload.html).toContain("Your milestone")
		expect(payload.html).toContain(renderData.milestoneTitle)
		expect(payload.html).toContain(renderData.courseTitle)
		expect(payload.html).toContain(`${renderData.reward} LRN`)
		expect(payload.html).toContain("View Dashboard")
		expect(payload.text).toContain(renderData.milestoneTitle)
	})

	it("milestone rejection email renders correctly (HTML + reason)", async () => {
		process.env.RESEND_API_KEY = "re_test"

		resendSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Milestone Rejected",
			template: "milestone-rejected-admin",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(resendSendMock).toHaveBeenCalledTimes(1)

		const payload = resendSendMock.mock.calls[0][0]
		expect(payload.html).toContain("Your milestone was not approved")
		expect(payload.html).toContain("Reason:")
		expect(payload.html).toContain(renderData.rejectionReason)
		expect(payload.html).toContain(renderData.milestoneUrl)
		expect(payload.text).toContain(renderData.rejectionReason)
	})

	it("scholarship approval notification is sent (proposal-approved)", async () => {
		process.env.RESEND_API_KEY = "re_test"

		resendSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Scholarship Approved",
			template: "proposal-approved",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(resendSendMock).toHaveBeenCalledTimes(1)

		const payload = resendSendMock.mock.calls[0][0]
		expect(payload.html).toContain("was approved")
		expect(payload.html).toContain(renderData.proposalTitle)
		expect(payload.html).toContain("Go to Dashboard")
	})

	it("disbursement notification is sent (milestone-verified)", async () => {
		process.env.RESEND_API_KEY = "re_test"

		resendSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Milestone Verified",
			template: "milestone-verified",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(resendSendMock).toHaveBeenCalledTimes(1)

		const payload = resendSendMock.mock.calls[0][0]
		expect(payload.html).toContain("Milestone verified")
		expect(payload.html).toContain("funds released")
		expect(payload.html).toContain("View Dashboard")
	})

	it("rejects invalid email addresses", async () => {
		process.env.RESEND_API_KEY = "re_test"
		resendSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: INVALID_TO,
			subject: "X",
			template: "milestone-verified",
			data: renderData,
		})

		expect(ok).toBe(false)
		expect(resendSendMock).not.toHaveBeenCalled()
	})

	it("handles delivery errors gracefully (no crash)", async () => {
		process.env.RESEND_API_KEY = "re_test"
		resendSendMock.mockRejectedValueOnce(new Error("provider failure"))

		const emailService = createEmailService()
		await expect(
			emailService.sendNotification({
				to: VALID_TO,
				subject: "X",
				template: "milestone-verified",
				data: renderData,
			}),
		).resolves.toBe(false)
	})

	it("uses SendGrid when EMAIL_API_KEY is set and Resend is not", async () => {
		delete process.env.RESEND_API_KEY
		process.env.EMAIL_API_KEY = "SG_TEST"

		sendGridSendMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Subject",
			template: "proposal-approved",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(sendGridSetApiKeyMock).toHaveBeenCalledWith("SG_TEST")
		expect(sendGridSendMock).toHaveBeenCalledTimes(1)

		const payload = sendGridSendMock.mock.calls[0][0]
		expect(payload.to).toBe(VALID_TO)
		expect(payload.subject).toBe("Subject")
		expect(payload.html).toContain(renderData.proposalTitle)
	})

	it("uses Nodemailer when SMTP is configured and no other provider is set", async () => {
		delete process.env.RESEND_API_KEY
		delete process.env.EMAIL_API_KEY
		process.env.SMTP_HOST = "smtp.test.local"
		process.env.SMTP_PORT = "587"
		process.env.SMTP_USER = "smtp-user"
		process.env.SMTP_PASS = "smtp-pass"
		process.env.SMTP_FROM = "smtp-from@example.com"

		nodemailerSendMailMock.mockResolvedValueOnce({})

		const emailService = createEmailService()
		const ok = await emailService.sendNotification({
			to: VALID_TO,
			subject: "Subject",
			template: "milestone-approved-admin",
			data: renderData,
		})

		expect(ok).toBe(true)
		expect(nodemailerCreateTransportMock).toHaveBeenCalledTimes(1)
		expect(nodemailerSendMailMock).toHaveBeenCalledTimes(1)

		const payload = nodemailerSendMailMock.mock.calls[0][0]
		expect(payload.to).toBe(VALID_TO)
		expect(payload.subject).toBe("Subject")
		expect(payload.html).toContain(renderData.milestoneTitle)
	})
})

