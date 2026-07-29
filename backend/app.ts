import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type Express } from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { validateScoringProfile } from "./features/profiles/profile.schema";
import { profilePath } from "./features/profiles/profile.repository";
import { createFileProfileRepository } from "./features/profiles/profile.repository";
import { createProfileController } from "./features/profiles/profile.controller";
import { createProfileRoutes } from "./features/profiles/profile.routes";
import type { MongoDatabase } from "./shared/db";
import {
  createMongoCompetitionRepository
} from "./features/competitions/competition.repository";
import { createCompetitionService } from "./features/competitions/competition.service";
import { createCompetitionController } from "./features/competitions/competition.controller";
import { createCompetitionLookupController } from "./features/competitions/competition.lookup.controller";
import { createCompetitionRoutes } from "./features/competitions/competition.routes";
import {
  SCOUTER_COOKIE,
  SCOUTER_COOKIE_TTL_SECONDS
} from "./features/scouter/scouter.types";
import { createMongoScouterRepository } from "./features/scouter/scouter.repository";
import { createScouterService } from "./features/scouter/scouter.service";
import { createScouterController } from "./features/scouter/scouter.controller";
import { createScouterRoutes } from "./features/scouter/scouter.routes";
import {
  createMongoRecordRepository
} from "./features/records/record.repository";
import { createRecordService } from "./features/records/record.service";
import { createRecordController } from "./features/records/record.controller";
import { createRecordRoutes } from "./features/records/record.routes";
import { createGroupsCsv } from "./group-export";
import { createMongoOfficialScoreRepository } from "./features/official-scores/official-score.repository";
import { createOfficialScoreService } from "./features/official-scores/official-score.service";
import { createOfficialScoreController } from "./features/official-scores/official-score.controller";
import { createOfficialScoreRoutes } from "./features/official-scores/official-score.routes";
import { createTeamsController } from "./features/teams/team.controller";
import { createTeamsRoutes } from "./features/teams/team.routes";
import { createMongoRecordExportDataLoader } from "./mongo-record-export";
import {
  createRecordsCsv,
  loadScoringProfile,
  type RecordExportDataLoader
} from "./record-export";
import {
  InMemoryMatchBroadcaster,
  type MatchBroadcaster
} from "./match-broadcaster";
import { openMatchNumberStream } from "./match-broadcast-stream";
import { buildTeamRollups, type ScoutRecordForRollup } from "./features/teams/team-rollup";

export type AppOptions = {
  profileStoragePath?: string;
  mongoDatabase?: MongoDatabase;
  mongoUrl?: string;
  loadRecordExportData?: RecordExportDataLoader;
  matchBroadcaster?: MatchBroadcaster;
};

async function saveProfile(profileStoragePath: string, profile: ScoringProfile): Promise<void> {
  await mkdir(profileStoragePath, { recursive: true });
  const destination = profilePath(profileStoragePath, profile.name);
  const temporaryPath = path.join(profileStoragePath, `.${profile.name}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await rename(temporaryPath, destination);
}

function validationResponse(errors: Array<{ path: string; message: string; code: string }>) {
  return {
    error: "Invalid ScoringProfile",
    errors
  };
}

function errorResponse(message: string) {
  return { error: message };
}

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return {
    error: "Invalid request",
    errors
  };
}

const matchNumberBodySchema = z.object({
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

async function loadProfileForCompetition(
  profileStoragePath: string,
  scoringProfileName: string
) {
  return loadScoringProfile(
    profileStoragePath,
    path.join(profileStoragePath, `${scoringProfileName}.json`)
  );
}

function requireMongo(req: express.Request, res: express.Response, next: express.NextFunction) {
  const db = req.app.locals.mongoDatabase as MongoDatabase | undefined;
  if (!db) {
    res.status(503).json(errorResponse("Database not configured"));
    return;
  }
  next();
}

export function createApp(options: AppOptions = {}): Express {
  const profileStoragePath = options.profileStoragePath ?? process.env.PROFILE_STORAGE_PATH ?? "/data/profiles";
  const loadRecordExportData = options.loadRecordExportData ?? createMongoRecordExportDataLoader({
    mongoUrl: options.mongoUrl ?? process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/miniscout",
    profileStoragePath
  });
  const matchBroadcaster = options.matchBroadcaster ?? new InMemoryMatchBroadcaster();
  const app = express();
  app.locals.mongoDatabase = options.mongoDatabase;

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get(["/healthz", "/api/healthz"], (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  const profileRepository = createFileProfileRepository(profileStoragePath);
  const profileController = createProfileController(profileRepository);
  app.use("/api", createProfileRoutes(profileController));

  if (options.mongoDatabase) {
    const competitionRepository = createMongoCompetitionRepository(options.mongoDatabase);
    const competitionService = createCompetitionService(competitionRepository, profileRepository);
    app.locals.competitionService = competitionService;
    const competitionController = createCompetitionController(competitionService);
    const competitionLookupController = createCompetitionLookupController({
      competitionService,
      profileStoragePath
    });
    app.use("/api", createCompetitionRoutes({ controller: competitionController, lookupController: competitionLookupController }, requireMongo));

    const recordRepository = createMongoRecordRepository(options.mongoDatabase);
    const recordService = createRecordService(recordRepository);
    const recordController = createRecordController({
      recordService,
      competitionService,
      profileStoragePath,
      cookieName: SCOUTER_COOKIE
    });
    app.use("/api", createRecordRoutes(recordController, requireMongo));

    const scouterRepository = createMongoScouterRepository(options.mongoDatabase);
    const scouterService = createScouterService(scouterRepository);
    const scouterController = createScouterController({ scouterService, competitionService });
    app.use("/api", createScouterRoutes(scouterController, requireMongo));

    const officialScoreRepository = createMongoOfficialScoreRepository(options.mongoDatabase);
    const officialScoreService = createOfficialScoreService(officialScoreRepository);
    const officialScoreController = createOfficialScoreController({
      service: officialScoreService,
      competitionService
    });
    app.use("/api", createOfficialScoreRoutes(officialScoreController, requireMongo));

    const teamsController = createTeamsController({
      competitionService,
      database: options.mongoDatabase,
      profileStoragePath
    });
    app.use("/api", createTeamsRoutes(teamsController, requireMongo));
  }

  app.put("/api/admin/competitions/:id/official-scores", requireMongo, async (request, response, next) => {
    const competitionService = request.app.locals.competitionService;
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const competitionId = String(request.params.id);
    const parsed = officialScoreUpsertSchema.safeParse({
      ...(request.body ?? {}),
      competition_id: competitionId
    });
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
      const competition = await competitionService.findById(competitionId);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const view = await upsertOfficialScore(database, parsed.data);
      response.status(200).json(view);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/competitions/:id/official-scores", requireMongo, async (request, response, next) => {
    const competitionService = request.app.locals.competitionService;
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const competitionId = String(request.params.id);
    try {
      const competition = await competitionService.findById(competitionId);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const officialScores = await listOfficialScoresForCompetition(database, competition._id);
      response.status(200).json({ official_scores: officialScores });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/competitions/:id/teams", requireMongo, async (request, response, next) => {
    const competitionService = request.app.locals.competitionService;
    const database = request.app.locals.mongoDatabase as MongoDatabase;
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

      const profile = await loadProfileForCompetition(profileStoragePath, competition.scoring_profile_name);
      const rollups = buildTeamRollups(
        records.map((doc): ScoutRecordForRollup => ({
          _id: doc._id,
          match_number: doc.match_number,
          team_number: doc.team_number,
          values: doc.values
        })),
        profile
      );

      response.status(200).json({ teams: rollups });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/export/groups.csv", async (_request, response, next) => {
    try {
      const exportData = await loadRecordExportData();
      if (!exportData) return void response.status(404).json({ error: "Competition not found" });
      const profile = await loadScoringProfile(profileStoragePath, exportData.scoringProfilePath);
      response.status(200).set("Content-Disposition", "attachment; filename=\"groups.csv\"").type("text/csv").send(createGroupsCsv(exportData.records, profile, exportData.officialScoresByMatch));
    } catch (error) { next(error); }
  });

  app.post("/api/admin/export/records.csv", async (_request, response, next) => {
    try {
      const exportData = await loadRecordExportData();
      if (!exportData) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const profile = await loadScoringProfile(profileStoragePath, exportData.scoringProfilePath);
      const csv = createRecordsCsv(exportData.records, profile, exportData.officialScoresByMatch);
      response
        .status(200)
        .set("Content-Disposition", "attachment; filename=\"records.csv\"")
        .type("text/csv")
        .send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/scouter/competition/:competitionId", async (request, response, next) => {
    const competitionId = request.params.competitionId;
    try {
      const currentMatchNumber = await matchBroadcaster.getCurrent(competitionId);
      response.status(200).json({ competition_id: competitionId, current_match_number: currentMatchNumber });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/scouter/competition/:competitionId/match-number", async (request, response, next) => {
    const competitionId = request.params.competitionId;
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
      const { updatedAt } = await matchBroadcaster.setCurrent(competitionId, value);
      response.status(200).json({
        competition_id: competitionId,
        current_match_number: value,
        updated_at: updatedAt
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/scouter/competition/:competitionId/stream", (request, response) => {
    const competitionId = request.params.competitionId;
    openMatchNumberStream(matchBroadcaster, competitionId, response);
  });

  app.put("/api/admin/competition/:competitionId/match-number", async (request, response, next) => {
    const competitionId = request.params.competitionId;
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
      const { updatedAt } = await matchBroadcaster.setCurrent(competitionId, value);
      response.status(200).json({
        competition_id: competitionId,
        current_match_number: value,
        updated_at: updatedAt
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/competition/:competitionId/match-number", async (request, response, next) => {
    const competitionId = request.params.competitionId;
    try {
      const { updatedAt } = await matchBroadcaster.clearCurrent(competitionId);
      response.status(200).json({
        competition_id: competitionId,
        current_match_number: null,
        updated_at: updatedAt
      });
    } catch (error) {
      next(error);
    }
  });

  const jsonErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json(validationResponse([
        {
          path: "body",
          message: "must be valid JSON",
          code: "invalid_json"
        }
      ]));
      return;
    }
    next(error);
  };
  app.use(jsonErrorHandler);

  return app;
}