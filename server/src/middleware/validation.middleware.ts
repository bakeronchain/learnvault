import z, { ZodType } from "zod";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error-handler";

type SchemaMap = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

const formatErrors = (fieldErrors: Record<string, string[] | undefined>) =>
  Object.entries(fieldErrors).map(([field, messages]) => ({
    field,
    message: messages?.[0] ?? "Invalid value",
  }));

export const validate =
  (schemas: SchemaMap) => (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success)
        throw new AppError(
          "Validation failed",
          400,
          formatErrors(result.error.flatten().fieldErrors),
        );
      req.body = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success)
        throw new AppError(
          "Validation failed",
          400,
          formatErrors(result.error.flatten().fieldErrors),
        );
      req.query = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success)
        throw new AppError(
          "Validation failed",
          400,
          formatErrors(result.error.flatten().fieldErrors),
        );
      req.params = result.data as Request["params"];
    }

    next();
  };