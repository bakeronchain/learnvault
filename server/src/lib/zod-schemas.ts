import { z } from "zod"

export const courseIdParamSchema = z.object({
	courseId: z
		.string({ message: "Course ID is required" })
		.cuid({ message: "Invalid course ID format" }),
})

export const coursesQuerySchema = z.object({
	limit: z
		.string()
		.optional()
		.transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
		.pipe(z.number().int().min(1).max(100)),
	cursor: z.string().optional(),
})

export const validateMilestoneSchema = z.object({
	courseId: z.string().cuid({ message: "Invalid course ID format" }),
	learnerAddress: z.string().min(1),
	milestoneId: z.number().int().nonnegative(),
})
