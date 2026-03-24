import type { Request, Response } from "express";
import { z } from "zod";
import { milestoneStore } from "../db/milestone-store";

const submitSchema = z.object({
  scholarAddress: z.string().min(1, "scholarAddress is required"),
  courseId: z.string().min(1, "courseId is required"),
  milestoneId: z.number().int().nonnegative("milestoneId must be a non-negative integer"),
  evidenceGithub: z.string().url().optional(),
  evidenceIpfsCid: z.string().optional(),
  evidenceDescription: z.string().optional(),
});

export async function submitMilestoneReport(req: Request, res: Response): Promise<void> {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const {
    scholarAddress,
    courseId,
    milestoneId,
    evidenceGithub,
    evidenceIpfsCid,
    evidenceDescription,
  } = parsed.data;

  // At least one form of evidence must be provided
  if (!evidenceGithub && !evidenceIpfsCid && !evidenceDescription) {
    res.status(400).json({
      error: "At least one evidence field is required (evidenceGithub, evidenceIpfsCid, or evidenceDescription)",
    });
    return;
  }

  try {
    const report = await milestoneStore.createReport({
      scholar_address: scholarAddress,
      course_id: courseId,
      milestone_id: milestoneId,
      evidence_github: evidenceGithub ?? null,
      evidence_ipfs_cid: evidenceIpfsCid ?? null,
      evidence_description: evidenceDescription ?? null,
    });

    res.status(201).json({ data: report });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_REPORT") {
      res.status(409).json({
        error: "A report for this milestone has already been submitted",
      });
      return;
    }
    console.error("[milestones] submitMilestoneReport error:", err);
    res.status(500).json({ error: "Failed to submit milestone report" });
  }
}
