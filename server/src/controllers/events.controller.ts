import type { Request, Response } from "express";

const EVENTS = [
  {
    id: "evt_1",
    type: "milestone.completed",
    entityId: "stellar-basics",
    timestamp: "2026-03-21T14:02:11.000Z"
  },
  {
    id: "evt_2",
    type: "validator.approved",
    entityId: "soroban-fundamentals",
    timestamp: "2026-03-21T17:45:41.000Z"
  }
] as const;

export const getEvents = (req: Request, res: Response): void => {
  const typeFilter = typeof req.query.type === "string" ? req.query.type : undefined;
  const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);

  const normalizedLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
  const filtered = typeFilter
    ? EVENTS.filter((event) => event.type === typeFilter)
    : EVENTS;

  res.status(200).json({
    data: filtered.slice(0, normalizedLimit)
  });
};
