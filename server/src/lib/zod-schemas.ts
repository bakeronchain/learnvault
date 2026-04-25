import { z } from "zod"

const requiredString = (field: string, maxLength?: number) => {
	const schema = z
		.string({
			required_error: `${field} is required`,
			invalid_type_error: `${field} must be a string`,
		})
		.trim()
		.min(1, `${field} is required`)
	
	if (maxLength) {
		return schema.max(maxLength, `${field} must be ${maxLength} characters or fewer`)
	}
	
	return schema
}

const optionalTrimmedString = (field: string, maxLength?: number) => {
	const schema = z
		.string({
			invalid_type_error: `${field} must be a string`,
		})
		.trim()
		.min(1, `${field} cannot be empty`)
	
	if (maxLength) {
		return schema.max(maxLength, `${field} must be ${maxLength} characters or fewer`).optional()
	}
	
	return schema.optional()
}

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

export const peerReviewSubmitBodySchema = z
	.object({
		verdict: z.enum(["approve", "reject"], {
			required_error: "verdict is required",
			invalid_type_error: "verdict must be approve or reject",
		}),
		comment: z
			.string()
			.max(500, "comment must be 500 characters or fewer")
			.optional(),
	})
	.strict()

export const validateMilestoneSchema = z.object({
	courseId: z.string().cuid({ message: "Invalid course ID format" }),
	learnerAddress: z.string().min(1),
	milestoneId: z.number().int().nonnegative(),
})

export const legacyMilestoneSubmitBodySchema = z
	.object({
		scholarAddress: requiredString("scholarAddress").max(100),
		courseId: requiredString("courseId").max(100),
		milestoneId: requiredInteger("milestoneId"),
		evidenceGithub: z
			.string({
				invalid_type_error: "evidenceGithub must be a string",
			})
			.url("evidenceGithub must be a valid URL")
			.max(500, "evidenceGithub must be 500 characters or fewer")
			.optional(),
		evidenceIpfsCid: optionalTrimmedString("evidenceIpfsCid", 100),
		evidenceDescription: optionalTrimmedString("evidenceDescription", 2000),
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
		learner_address: requiredString("learner_address", 100),
		course_id: requiredString("course_id", 100),
		milestone_id: requiredInteger("milestone_id"),
		evidence_url: z
			.string({
				required_error: "evidence_url is required",
				invalid_type_error: "evidence_url must be a string",
			})
			.trim()
			.url("evidence_url must be a valid URL")
			.max(500, "evidence_url must be 500 characters or fewer"),
	})
	.strict()

export const approveMilestoneBodySchema = z
	.object({
		note: optionalTrimmedString("note", 1000),
	})
	.strict()

const milestoneIdsSchema = z
	.array(requiredInteger("milestoneIds"))
	.min(1, "milestoneIds must include at least one milestone id")
	.superRefine((ids, ctx) => {
		const seen = new Set<number>()
		ids.forEach((id, index) => {
			if (id <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [index],
					message: "milestoneIds entries must be positive integers",
				})
			}

			if (seen.has(id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [index],
					message: "milestoneIds must not contain duplicates",
				})
				return
			}

			seen.add(id)
		})
	})

export const batchApproveMilestonesBodySchema = z
	.object({
		milestoneIds: milestoneIdsSchema,
	})
	.strict()

export const rejectMilestoneBodySchema = z
	.object({
		reason: requiredString("reason", 1000),
	})
	.strict()

export const batchRejectMilestonesBodySchema = z
	.object({
		milestoneIds: milestoneIdsSchema,
		reason: optionalTrimmedString("reason"),
	})
	.strict()

export const updateCommentBodySchema = z
	.object({
		content: requiredString("content", 2000),
	})
	.strict()

export const createCommentBodySchema = z
	.object({
		proposalId: optionalTrimmedString("proposalId", 100),
		proposal_id: optionalTrimmedString("proposal_id", 100),
		content: optionalTrimmedString("content"),
		body: optionalTrimmedString("body"),
		author_address: optionalTrimmedString("author_address", 100),
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
		course_id: requiredString("course_id", 100),
		learner_address: requiredString("learner_address", 100),
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
		learner_address: requiredString("learner_address", 100),
		course_id: requiredString("course_id", 100),
		tx_hash: requiredString("tx_hash", 200),
	})
	.strict()

export const userProfileSchema = z
	.object({
		display_name: z
			.string()
			.trim()
			.min(3, "Display name must be at least 3 characters")
			.max(50, "Display name cannot exceed 50 characters")
			.optional()
			.nullable(),
		bio: z
			.string()
			.max(2000, "Bio cannot exceed 2000 characters")
			.optional()
			.nullable(),
		avatar_url: z
			.string()
			.url("Avatar must be a valid URL")
			.max(2048, "URL is too long")
			.optional()
			.nullable(),
		twitter: z
			.string()
			.trim()
			.max(255, "Twitter handle/URL is too long")
			.optional()
			.nullable(),
		github: z
			.string()
			.trim()
			.max(255, "GitHub username/URL is too long")
			.optional()
			.nullable(),
		website: z
			.string()
			.url("Website must be a valid URL")
			.max(2048, "URL is too long")
			.optional()
			.nullable(),
	})
	.strict()

