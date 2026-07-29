import type { Request, Response, NextFunction } from "express";
import { officialScoreUpsertSchema } from "./official-score.schema";
import type { OfficialScoreService } from "./official-score.service";
import type { CompetitionService } from "../competitions/competition.service";

export type OfficialScoreController = {
  upsert(request: Request, response: Response, next: NextFunction): Promise<void>;
  list(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type OfficialScoreControllerDeps = {
  service: OfficialScoreService;
  competitionService: CompetitionService;
};

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return { error: "Invalid request", errors };
}

function errorResponse(message: string) {
  return { error: message };
}

export function createOfficialScoreController(deps: OfficialScoreControllerDeps): OfficialScoreController {
  const { service, competitionService } = deps;
  return {
    async upsert(request, response, next) {
      const competitionId = String(request.params.id);
      const parsed = officialScoreUpsertSchema.safeParse({
        ...(request.body ?? {}),
        competition_id: competitionId
      });
      if (!parsed.success) {
        response.status(400).json(fieldErrors(parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }))));
        return;
      }
      try {
        const competition = await competitionService.findById(competitionId);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const view = await service.upsertScore(parsed.data);
        response.status(200).json(view);
      } catch (error) {
        next(error);
      }
    },
    async list(request, response, next) {
      const competitionId = String(request.params.id);
      try {
        const competition = await competitionService.findById(competitionId);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const officialScores = await service.listScores(competition._id);
        response.status(200).json({ official_scores: officialScores });
      } catch (error) {
        next(error);
      }
    }
  };
}