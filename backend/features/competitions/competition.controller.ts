import type { Request, Response, NextFunction } from "express";
import { mintCompetitionSchema } from "./competition.schema";
import { CompetitionProfileMissingError, type CompetitionService } from "./competition.service";

export type CompetitionController = {
  mint(request: Request, response: Response, next: NextFunction): Promise<void>;
  list(request: Request, response: Response, next: NextFunction): Promise<void>;
};

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return { error: "Invalid request", errors };
}

function errorResponse(message: string) {
  return { error: message };
}

export function createCompetitionController(service: CompetitionService): CompetitionController {
  return {
    async mint(request, response, next) {
      const parsed = mintCompetitionSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }));
        response.status(400).json(fieldErrors(errors));
        return;
      }
      try {
        const result = await service.mintCompetition(parsed.data);
        response.status(200).json(result);
      } catch (error) {
        if (error instanceof CompetitionProfileMissingError) {
          response.status(404).json(errorResponse(error.message));
          return;
        }
        next(error);
      }
    },
    async list(_request, response, next) {
      try {
        const competitions = await service.list();
        response.status(200).json({ competitions });
      } catch (error) {
        next(error);
      }
    }
  };
}