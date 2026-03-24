import { z } from "zod";

export const courseIdParamSchema = z.object({
  courseId: z
    .string({ message: "Course ID is required" })
    .cuid({ message: "Invalid course ID format" }),
});

export const validateMilestoneSchema = z.object({
  courseId: z.string().cuid({ message: "Invalid course ID format" }),
  learnerAddress: z.string().min(1),
  milestoneId: z.number().int().nonnegative()
});