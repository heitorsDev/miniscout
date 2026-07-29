import type { Request, Response, NextFunction } from "express";
import { buildTeamRollups, type ScoutRecordForRollup } from "./team-rollup";
import type { ScoringProfileInput } from "../scoring/scoring";
import type { CompetitionService } from "../competitions/competition.service";
import type { MongoDatabase } from "../../shared/db";
import { loadValidatedProfile } from "../profiles/profile.service";

export type TeamsController = {
  rollupForCompetition(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type TeamsControllerDeps = {
  competitionService: CompetitionService;
  database: MongoDatabase;
  profileStoragePath: string;
};

function errorResponse(message: string) {
  return { error: message };
}

export function createTeamsController(deps: TeamsControllerDeps): TeamsController {
  const { competitionService, database, profileStoragePath } = deps;
  return {
    async rollupForCompetition(request, response, next) {
      const competitionId = String(request.params.id);
      try {
        const competition = await competitionService.findById(competitionId);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }

        const records = await database.collections.records
          .find({ competition_id: competition._id })
          .sort({ match_number: 1, team_number: 1, submitted_at: 1 })
          .toArray();

        const profile = await loadValidatedProfile(profileStoragePath, competition.scoring_profile_name);
        const rollups = buildTeamRollups(
          records.map((doc): ScoutRecordForRollup => ({
            _id: doc._id,
            match_number: doc.match_number,
            team_number: doc.team_number,
            values: doc.values
          })),
          profile as ScoringProfileInput
        );

        response.status(200).json({ teams: rollups });
      } catch (error) {
        next(error);
      }
    }
  };
}