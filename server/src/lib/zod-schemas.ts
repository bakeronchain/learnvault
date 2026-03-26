import { z } from "zod"

const requiredString = (field: string) =>
	z
		.string({
			required_error: `${field} is required`,
			invalid_type_error: `${field} must be a string`,
		})
		.trim()
		.min(1, `${field} is required`)

const optionalTrimmedString = (field: string) =>
	z
		.string({
			invalid_type_error: `${field} must be a string`,
		})
		.trim()
		.min(1, `${field} cannot be empty`)
		.optional()

const requiredInteger = (field: string) =>
	z
		.number({
			required_error: `${field} is required`,
			invalid_type_error: `${field} must be a number`,
		})
		.int(`${field} must be an integer`)
		.nonnegative(`${field} must be a non-negative integer`)

export const courseIdParamSchema = z.object({
	courseId: z
		.string({ message: "Course ID is required" })
		.cuid({ message: "Invalid course ID format" }),
})

export const milestoneReportIdParamSchema = z
	.object({
		id: z
			.string({
				required_error: "id is required",
				invalid_type_error: "id must be a string",
			})
			.regex(/^[1-9]\d*$/, "id must be a positive integer"),
	})
	.strict()

export const validateMilestoneSchema = z.object({
	courseId: z.string().cuid({ message: "Invalid course ID format" }),
	learnerAddress: z.string().min(1),
	milestoneId: z.number().int().nonnegative(),
})

export const legacyMilestoneSubmitBodySchema = z
	.object({
		scholarAddress: requiredString("scholarAddress"),
		courseId: requiredString("courseId"),
		milestoneId: requiredInteger("milestoneId"),
		evidenceGithub: z
			.string({
				invalid_type_error: "evidenceGithub must be a string",
			})
			.url("evidenceGithub must be a valid URL")
			.optional(),
		evidenceIpfsCid: optionalTrimmedString("evidenceIpfsCid"),
		evidenceDescription: optionalTrimmedString("evidenceDescription"),
	})
	.strict()
	.superRefine((data, ctx) => {
		if (
			data.evidenceGithub !== undefined ||
			data.evidenceIpfsCid !== undefined ||
			data.evidenceDescription !== undefined
		) {
			return
		}

		for (const field of [
			"evidenceGithub",
			"evidenceIpfsCid",
			"evidenceDescription",
		]) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [field],
				message:
					"At least one evidence field is required (evidenceGithub, evidenceIpfsCid, or evidenceDescription)",
			})
		}
	})

export const milestoneSubmitBodySchema = z
	.object({
		learner_address: requiredString("learner_address"),
		course_id: requiredString("course_id"),
		milestone_id: requiredInteger("milestone_id"),
		evidence_url: z
			.string({
				required_error: "evidence_url is required",
				invalid_type_error: "evidence_url must be a string",
			})
			.trim()
			.url("evidence_url must be a valid URL"),
	})
	.strict()

export const approveMilestoneBodySchema = z
	.object({
		note: optionalTrimmedString("note"),
	})
	.strict()

export const rejectMilestoneBodySchema = z
	.object({
		reason: requiredString("reason"),
	})
	.strict()

export const createCommentBodySchema = z
	.object({
		proposalId: optionalTrimmedString("proposalId"),
		proposal_id: optionalTrimmedString("proposal_id"),
		content: optionalTrimmedString("content"),
		body: optionalTrimmedString("body"),
		author_address: optionalTrimmedString("author_address"),
		parentId: z
			.number({
				invalid_type_error: "parentId must be a number",
			})
			.int("parentId must be an integer")
			.positive("parentId must be a positive integer")
			.optional(),
		parent_id: z
			.number({
				invalid_type_error: "parent_id must be a number",
			})
			.int("parent_id must be an integer")
			.positive("parent_id must be a positive integer")
			.optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		const usesSnakeCase =
			data.proposal_id !== undefined ||
			data.body !== undefined ||
			data.author_address !== undefined ||
			data.parent_id !== undefined

		if (usesSnakeCase) {
			if (data.proposal_id === undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["proposal_id"],
					message: "proposal_id is required",
				})
			}

			if (data.body === undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["body"],
					message: "body is required",
				})
			}

			if (data.author_address === undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["author_address"],
					message: "author_address is required",
				})
			}

			return
		}

		if (data.proposalId === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["proposalId"],
				message: "proposalId is required",
			})
		}

		if (data.content === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["content"],
				message: "content is required",
			})
		}
	})

export const createCredentialMetadataBodySchema = z
	.object({
		course_id: requiredString("course_id"),
		learner_address: requiredString("learner_address"),
		completed_at: z
			.string({
				required_error: "completed_at is required",
				invalid_type_error: "completed_at must be a string",
			})
			.datetime({ message: "completed_at must be a valid ISO 8601 datetime" }),
	})
	.strict()

export const enrollmentBodySchema = z
	.object({
		learner_address: requiredString("learner_address"),
		course_id: requiredString("course_id"),
		tx_hash: requiredString("tx_hash"),
	})
	.strict()
