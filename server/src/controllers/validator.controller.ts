import type { Request, Response } from "express";

export const validateMilestone = (req: Request, res: Response): void => {
  res.status(200).json({
    data: {
      approved: true,
      validator: "learnvault-validator",
      data: req.body
    }
  });
};
