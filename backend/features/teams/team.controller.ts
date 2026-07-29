import type { Request, Response, NextFunction } from "express";
import type { TeamService } from "./team.service";

export type TeamsController = {
  rollupForCompetition(request: Request, response: Response, next: NextFunction): Promise<void>;
};

function errorResponse(message: string) {
  return { error: message };
}

export function createTeamsController(deps: { teamService: TeamService }): TeamsController {
  const { teamService } = deps;
  return {
    async rollupForCompetition(request, response, next) {
      const competitionId = String(request.params.id);
      try {
        const rollups = await teamService.getRollupsForCompetition(competitionId);
        if (rollups === null) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        response.status(200).json({ teams: rollups });
      } catch (error) {
        next(error);
      }
    }
  };
}
