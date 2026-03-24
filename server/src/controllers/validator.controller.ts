import type { Request, Response } from "express";
import { z } from "zod";

const payloadSchema = z.object({
  courseId: z.string().min(1),
  learnerAddress: z.string().min(1),
  milestoneId: z.number().int().nonnegative()
});

export const validateMilestone = (req: Request, res: Response): void => {
  const parsed = payloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      issues: parsed.error.issues
    });
    return;
  }

  res.status(200).json({
    data: {
      approved: true,
      validator: "learnvault-validator",
      ...parsed.data
    }
  });
};
