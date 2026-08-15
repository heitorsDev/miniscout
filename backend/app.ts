import express, { type ErrorRequestHandler, type Express } from "express";
import cookieParser from "cookie-parser";
import { createFileProfileRepository } from "./features/profiles/profile.repository";
import { createProfileController } from "./features/profiles/profile.controller";
import { createProfileRoutes } from "./features/profiles/profile.routes";
import { createFileStyleProfileRepository } from "./features/style-profile/style-profile.repository";
import { createStyleProfileController } from "./features/style-profile/style-profile.controller";
import { createStyleProfileRoutes } from "./features/style-profile/style-profile.routes";
import type { MongoDatabase } from "./shared/db";
import {
  createMongoCompetitionRepository
} from "./features/competitions/competition.repository";
import { createCompetitionService } from "./features/competitions/competition.service";
import { createCompetitionController } from "./features/competitions/competition.controller";
import { createCompetitionLookupController } from "./features/competitions/competition.lookup.controller";
import { createCompetitionRoutes } from "./features/competitions/competition.routes";
import {
  SCOUTER_COOKIE
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

import { createMongoOfficialScoreRepository } from "./features/official-scores/official-score.repository";
import { createOfficialScoreService } from "./features/official-scores/official-score.service";
import { createOfficialScoreController } from "./features/official-scores/official-score.controller";
import { createOfficialScoreRoutes } from "./features/official-scores/official-score.routes";
import { createMongoTeamRepository } from "./features/teams/team.repository";
import { createTeamService } from "./features/teams/team.service";
import { createTeamsController } from "./features/teams/team.controller";
import { createTeamsRoutes } from "./features/teams/team.routes";

import {
  createInMemoryBroadcaster,
  type MatchBroadcaster
} from "./features/broadcast/broadcaster";
import { createBroadcastController } from "./features/broadcast/broadcast.controller";
import { createBroadcastRoutes } from "./features/broadcast/broadcast.routes";
import { createMongoRecordExportDataLoader } from "./features/csv-export/csv.repository";
import { createCsvExportController } from "./features/csv-export/csv.controller";
import { createCsvExportRoutes } from "./features/csv-export/csv.routes";
import type { RecordExportDataLoader } from "./features/csv-export/csv.types";
import { createFileTunnelRepository } from "./features/tunnel/tunnel.repository";
import { createTunnelController } from "./features/tunnel/tunnel.controller";
import { createTunnelRoutes } from "./features/tunnel/tunnel.routes";

export type AppOptions = {
  profileStoragePath?: string;
  styleProfileStoragePath?: string;
  tunnelUrlFilePath?: string;
  mongoDatabase?: MongoDatabase;
  mongoUrl?: string;
  loadRecordExportData?: RecordExportDataLoader;
  matchBroadcaster?: MatchBroadcaster;
};

function validationResponse(errors: Array<{ path: string; message: string; code: string }>) {
  return {
    error: "Invalid ScoringProfile",
    errors
  };
}

function errorResponse(message: string) {
  return { error: message };
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
  const styleProfileStoragePath = options.styleProfileStoragePath ?? process.env.STYLE_PROFILE_STORAGE_PATH ?? "/data/style-profile";
  const tunnelUrlFilePath = options.tunnelUrlFilePath ?? process.env.TUNNEL_URL_FILE ?? "/data/tunnel/url";
  const loadRecordExportData = options.loadRecordExportData ?? (
    options.mongoDatabase
      ? createMongoRecordExportDataLoader({
          database: options.mongoDatabase,
          profileStoragePath
        })
      : async () => null
  );
  const matchBroadcaster = options.matchBroadcaster ?? createInMemoryBroadcaster();
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

  const styleProfileRepository = createFileStyleProfileRepository(styleProfileStoragePath);
  const styleProfileController = createStyleProfileController(styleProfileRepository);
  app.use("/api", createStyleProfileRoutes(styleProfileController));

  const tunnelRepository = createFileTunnelRepository(tunnelUrlFilePath);
  const tunnelController = createTunnelController(tunnelRepository);
  app.use("/api", createTunnelRoutes(tunnelController));

  const broadcastController = createBroadcastController(matchBroadcaster);
  app.use("/api", createBroadcastRoutes(broadcastController, matchBroadcaster));

  const csvExportController = createCsvExportController({
    loadRecordExportData,
    profileStoragePath
  });
  app.use("/api", createCsvExportRoutes(csvExportController));

  if (options.mongoDatabase) {
    const competitionRepository = createMongoCompetitionRepository(options.mongoDatabase);
    const competitionService = createCompetitionService(competitionRepository, profileRepository);
    const competitionController = createCompetitionController(competitionService);
    const competitionLookupController = createCompetitionLookupController({
      competitionService
    });
    app.use("/api", createCompetitionRoutes({ controller: competitionController, lookupController: competitionLookupController }, requireMongo));

    const scouterRepository = createMongoScouterRepository(options.mongoDatabase);
    const scouterService = createScouterService(scouterRepository);
    const scouterController = createScouterController({ scouterService, competitionService });
    app.use("/api", createScouterRoutes(scouterController, requireMongo));

    const recordRepository = createMongoRecordRepository(options.mongoDatabase);
    const recordService = createRecordService({
      repository: recordRepository,
      scouterService,
      profileStoragePath
    });
    const recordController = createRecordController({
      recordService,
      competitionService,
      cookieName: SCOUTER_COOKIE
    });
    app.use("/api", createRecordRoutes(recordController, requireMongo));

    const officialScoreRepository = createMongoOfficialScoreRepository(options.mongoDatabase);
    const officialScoreService = createOfficialScoreService(officialScoreRepository);
    const officialScoreController = createOfficialScoreController({
      service: officialScoreService,
      competitionService
    });
    app.use("/api", createOfficialScoreRoutes(officialScoreController, requireMongo));

    const teamRepository = createMongoTeamRepository(options.mongoDatabase);
    const teamService = createTeamService({
      competitionService,
      teamRepository,
      profileStoragePath
    });
    const teamsController = createTeamsController({ teamService });
    app.use("/api", createTeamsRoutes(teamsController, requireMongo));
  }


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