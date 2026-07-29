import type { Request, Response, NextFunction } from "express";
import { scoutRecordInputSchema } from "./record.schema";
import { RecordSubmissionError, type RecordService } from "./record.service";
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
  cookieName: string;
};

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return { error: "Invalid request", errors };
}

function errorResponse(message: string) {
  return { error: message };
}

export function createRecordController(deps: RecordControllerDeps): RecordController {
  const { recordService, competitionService, cookieName } = deps;
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
          scouter_name: record.scouter_name
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
        const groups = await recordService.listGroupsForCompetition(competition);
        response.status(200).json({ groups });
      } catch (error) {
        if (error instanceof RecordSubmissionError) {
          response.status(500).json(errorResponse(error.message));
          return;
        }
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
        const group = await recordService.getGroupForCompetition(
          competition,
          String(request.params.match),
          String(request.params.team)
        );
        if (!group) {
          response.status(404).json(errorResponse("Group not found"));
          return;
        }
        response.status(200).json({ group });
      } catch (error) {
        if (error instanceof RecordSubmissionError) {
          response.status(500).json(errorResponse(error.message));
          return;
        }
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
