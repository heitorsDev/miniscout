import type { Request, Response, NextFunction } from "express";
import { readFile } from "node:fs/promises";
import type { CompetitionService } from "./competition.service";
import { profilePath } from "../profiles/profile.repository";

export type CompetitionLookupController = {
  resolveByQrToken(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type CompetitionLookupControllerDeps = {
  competitionService: CompetitionService;
  profileStoragePath: string;
};

function errorResponse(message: string) {
  return { error: message };
}

export function createCompetitionLookupController(deps: CompetitionLookupControllerDeps): CompetitionLookupController {
  const { competitionService, profileStoragePath } = deps;
  return {
    async resolveByQrToken(request, response, next) {
      const qrToken = String(request.params.token);
      try {
        const competition = await competitionService.findByQrToken(qrToken);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }

        let profile: unknown;
        try {
          const contents = await readFile(profilePath(profileStoragePath, competition.scoring_profile_name), "utf8");
          profile = JSON.parse(contents);
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            response.status(500).json(errorResponse("Competition profile missing on disk"));
            return;
          }
          next(error);
          return;
        }

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
        next(error);
      }
    }
  };
}