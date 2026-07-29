import type { Request, Response, NextFunction } from "express";
import {
  CompetitionProfileDiskMissingError,
  type CompetitionService
} from "./competition.service";

export type CompetitionLookupController = {
  resolveByQrToken(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type CompetitionLookupControllerDeps = {
  competitionService: CompetitionService;
};

function errorResponse(message: string) {
  return { error: message };
}

export function createCompetitionLookupController(deps: CompetitionLookupControllerDeps): CompetitionLookupController {
  const { competitionService } = deps;
  return {
    async resolveByQrToken(request, response, next) {
      const qrToken = String(request.params.token);
      try {
        const result = await competitionService.lookupByQrToken(qrToken);
        if (!result) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const { competition, profile } = result;
        response.status(200).json({
          competition: {
            _id: competition._id,
            name: competition.name,
            scoring_profile_name: competition.scoring_profile_name,
            qr_token: competition.qr_token
          },
          profile
        });
      } catch (error) {
        if (error instanceof CompetitionProfileDiskMissingError) {
          response.status(500).json(errorResponse("Competition profile missing on disk"));
          return;
        }
        next(error);
      }
    }
  };
}
