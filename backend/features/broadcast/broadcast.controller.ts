import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { MatchBroadcaster } from "./broadcaster";

export type BroadcastController = {
  getCurrent(request: Request, response: Response, next: NextFunction): Promise<void>;
  setCurrent(request: Request, response: Response, next: NextFunction): Promise<void>;
  clearCurrent(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export const matchNumberBodySchema = z.object({
  value: z.number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .positive("must be a positive integer")
}).strict();

function matchValidationResponse(
  errors: Array<{ path: string; message: string; code: string }>
) {
  return {
    error: "Invalid match number",
    errors
  };
}

export function createBroadcastController(broadcaster: MatchBroadcaster): BroadcastController {
  return {
    async getCurrent(request, response, next) {
      const competitionId = String(request.params.competitionId);
      try {
        const currentMatchNumber = await broadcaster.getCurrent(competitionId);
        response.status(200).json({ competition_id: competitionId, current_match_number: currentMatchNumber });
      } catch (error) {
        next(error);
      }
    },
    async setCurrent(request, response, next) {
      const competitionId = String(request.params.competitionId);
      const result = matchNumberBodySchema.safeParse(request.body);
      if (!result.success) {
        response.status(400).json(matchValidationResponse(
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code
          }))
        ));
        return;
      }
      try {
        const { value } = result.data;
        const { updatedAt } = await broadcaster.setCurrent(competitionId, value);
        response.status(200).json({
          competition_id: competitionId,
          current_match_number: value,
          updated_at: updatedAt
        });
      } catch (error) {
        next(error);
      }
    },
    async clearCurrent(request, response, next) {
      const competitionId = String(request.params.competitionId);
      try {
        const { updatedAt } = await broadcaster.clearCurrent(competitionId);
        response.status(200).json({
          competition_id: competitionId,
          current_match_number: null,
          updated_at: updatedAt
        });
      } catch (error) {
        next(error);
      }
    }
  };
}