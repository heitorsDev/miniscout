import type { Request, Response, NextFunction } from "express";
import { scoutRecordInputSchema } from "./record.schema";
import type { RecordService } from "./record.service";
import { loadScoringProfile } from "../profiles/profile.service";
import { loadProfileFromDisk } from "../profiles/profile.service";
import { profilePath } from "../profiles/profile.repository";
import { readFile } from "node:fs/promises";
import { validateScoringProfile } from "../profiles/profile.schema";
import type { CompetitionService } from "../competitions/competition.service";

export type RecordController = {
  submit(request: Request, response: Response, next: NextFunction): Promise<void>;
  delete(request: Request, response: Response, next: NextFunction): Promise<void>;
  listGroups(request: Request, response: Response, next: NextFunction): Promise<void>;
  getGroup(request: Request, response: Response, next: NextFunction): Promise<void>;
  existingScouts(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type RecordControllerDeps = {
  recordService: RecordService;
  competitionService: CompetitionService;
  profileStoragePath: string;
  cookieName: string;
};

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return { error: "Invalid request", errors };
}

function errorResponse(message: string) {
  return { error: message };
}

export function createRecordController(deps: RecordControllerDeps): RecordController {
  const { recordService, competitionService, profileStoragePath, cookieName } = deps;
  return {
    async submit(request, response, next) {
      const cookieId = request.cookies?.[cookieName];
      if (!cookieId) {
        response.status(401).json(errorResponse("Scouter cookie missing"));
        return;
      }
      const parsed = scoutRecordInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        response.status(400).json(fieldErrors(parsed.error.issues.map((issue) => ({
          path: `${issue.path.join(".")}`,
          message: issue.message,
          code: issue.code
        }))));
        return;
      }
      try {
        const competition = await competitionService.findByQrToken(String(request.params.token));
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const record = await recordService.createRecord(
          competition._id,
          cookieId,
          parsed.data
        );
        response.status(201).json({
          record_id: record.record_id,
          scouter_name: parsed.data.scouter_name
        });
      } catch (error) {
        next(error);
      }
    },
    async delete(request, response, next) {
      const recordId = String(request.params.id);
      try {
        const deleted = await recordService.deleteRecord(recordId);
        if (!deleted) {
          response.status(404).json(errorResponse("ScoutRecord not found"));
          return;
        }
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
    async listGroups(request, response, next) {
      const competitionId = String(request.params.id);
      try {
        const competition = await competitionService.findById(competitionId);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const profile = await loadValidatedProfileForCompetition(profileStoragePath, competition.scoring_profile_name);
        const groups = await recordService.listGroupsForCompetition(competitionId, profile);
        response.status(200).json({ groups });
      } catch (error) {
        next(error);
      }
    },
    async getGroup(request, response, next) {
      try {
        const competition = await competitionService.findById(String(request.params.id));
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const profile = await loadValidatedProfileForCompetition(profileStoragePath, competition.scoring_profile_name);
        const group = await recordService.getGroupForCompetition(
          competition._id,
          String(request.params.match),
          String(request.params.team),
          profile
        );
        if (!group) {
          response.status(404).json(errorResponse("Group not found"));
          return;
        }
        response.status(200).json({ group });
      } catch (error) {
        next(error);
      }
    },
    async existingScouts(request, response, next) {
      try {
        const competition = await competitionService.findByQrToken(String(request.params.token));
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const excludedCookieId = request.cookies?.[cookieName];
        const result = await recordService.findExistingScouts(
          competition._id,
          String(request.query.match_number ?? ""),
          String(request.query.team_number ?? ""),
          excludedCookieId
        );
        response.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  };
}

async function loadValidatedProfileForCompetition(
  profileStoragePath: string,
  name: string
) {
  try {
    const contents = await readFile(profilePath(profileStoragePath, name), "utf8");
    const result = validateScoringProfile(JSON.parse(contents));
    if (!result.success) {
      throw new Error("Competition profile invalid");
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("Competition profile missing on disk");
    }
    throw error;
  }
}

// Re-export to avoid unused import warnings during the migration.
export { loadScoringProfile, loadProfileFromDisk };