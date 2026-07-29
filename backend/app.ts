import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type Express } from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { profileNameSchema, validateScoringProfile, type ScoringProfile } from "./profile-schema";
import { profilePath } from "./profile-storage";
import type { MongoDatabase } from "./db";
import {
  findCompetitionById,
  findCompetitionByQrToken,
  listCompetitionsAdmin,
  mintCompetition,
  mintCompetitionSchema,
  type MintCompetitionInput
} from "./competitions";
import {
  SCOUTER_COOKIE,
  SCOUTER_COOKIE_TTL_SECONDS,
  draftInputSchema,
  findScouterByCookie,
  loadDraft,
  registerScouter,
  scouterNameSchema,
  upsertDraft
} from "./scouter";
import {
  createScoutRecord,
  listRecordsForCompetitionAdmin,
  scoutRecordInputSchema
} from "./records";
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

  app.post("/api/admin/profiles", async (request, response, next) => {
    const result = validateScoringProfile(request.body);
    if (!result.success) {
      response.status(400).json(validationResponse(result.errors));
      return;
    }

    try {
      await saveProfile(profileStoragePath, result.data);
      response.status(200).json(result.data);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/profiles/:name", async (request, response, next) => {
    const nameResult = profileNameSchema.safeParse(request.params.name);
    if (!nameResult.success) {
      response.status(400).json(validationResponse(nameResult.error.issues.map((issue) => ({
        path: "name",
        message: issue.message,
        code: issue.code
      }))));
      return;
    }

    try {
      const contents = await readFile(profilePath(profileStoragePath, nameResult.data), "utf8");
      response.status(200).type("application/json").send(contents);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        response.status(404).json({ error: "Profile not found" });
        return;
      }
      next(error);
    }
  });

  app.post("/api/admin/competitions", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
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
    const input: MintCompetitionInput = parsed.data;

    let profileExists = true;
    try {
      await readFile(profilePath(profileStoragePath, input.scoring_profile_name), "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        profileExists = false;
      } else {
        next(error);
        return;
      }
    }
    if (!profileExists) {
      response.status(404).json(errorResponse(`ScoringProfile "${input.scoring_profile_name}" not found`));
      return;
    }

    try {
      const result = await mintCompetition(database, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/competitions", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    try {
      const competitions = await listCompetitionsAdmin(database);
      response.status(200).json({ competitions });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/competitions/:id/records", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const competitionId = String(request.params.id);
    try {
      const competition = await findCompetitionById(database, competitionId);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const records = await listRecordsForCompetitionAdmin(database, competition._id);
      response.status(200).json({ records });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/competitions/:token", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const qrToken = String(request.params.token);
    try {
      const competition = await findCompetitionByQrToken(database, qrToken);
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
  });

  app.post("/api/competitions/:token/scouter", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const qrToken = String(request.params.token);
    try {
      const competition = await findCompetitionByQrToken(database, qrToken);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const nameResult = scouterNameSchema.safeParse(request.body?.name);
      if (!nameResult.success) {
        response.status(400).json(fieldErrors(nameResult.error.issues.map((issue) => ({
          path: `name.${issue.path.join(".")}`,
          message: issue.message,
          code: issue.code
        }))));
        return;
      }
      const registration = await registerScouter(database, nameResult.data, competition.qr_token);
      response.cookie(SCOUTER_COOKIE, registration.scouter_cookie_id, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.secure,
        maxAge: SCOUTER_COOKIE_TTL_SECONDS * 1000,
        path: "/"
      });
      response.status(200).json({
        scouter_cookie_id: registration.scouter_cookie_id,
        scouter_name: registration.scouter_name
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/competitions/:token/scouter", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const cookieId = request.cookies?.[SCOUTER_COOKIE];
    if (!cookieId) {
      response.status(204).end();
      return;
    }
    try {
      const scouter = await findScouterByCookie(database, cookieId);
      if (!scouter) {
        response.status(204).end();
        return;
      }
      response.status(200).json({
        scouter_cookie_id: scouter._id,
        scouter_name: scouter.display_name
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/competitions/:token/draft", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const qrToken = String(request.params.token);
    const cookieId = request.cookies?.[SCOUTER_COOKIE];
    if (!cookieId) {
      response.status(401).json(errorResponse("Scouter cookie missing"));
      return;
    }
    const parsed = draftInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json(fieldErrors(parsed.error.issues.map((issue) => ({
        path: `${issue.path.join(".")}`,
        message: issue.message,
        code: issue.code
      }))));
      return;
    }
    try {
      const competition = await findCompetitionByQrToken(database, qrToken);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const draft = await upsertDraft(database, cookieId, competition.qr_token, parsed.data);
      response.status(200).json({
        draft: {
          scouter_name: draft.scouter_name,
          match_number: draft.match_number,
          team_number: draft.team_number,
          values: draft.values,
          updated_at: draft.updated_at.toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/competitions/:token/draft", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const qrToken = String(request.params.token);
    const cookieId = request.cookies?.[SCOUTER_COOKIE];
    if (!cookieId) {
      response.status(204).end();
      return;
    }
    try {
      const competition = await findCompetitionByQrToken(database, qrToken);
      if (!competition) {
        response.status(204).end();
        return;
      }
      const draft = await loadDraft(database, cookieId, competition.qr_token);
      if (!draft) {
        response.status(200).json({ draft: null });
        return;
      }
      response.status(200).json({
        draft: {
          scouter_name: draft.scouter_name,
          match_number: draft.match_number,
          team_number: draft.team_number,
          values: draft.values,
          updated_at: draft.updated_at.toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/competitions/:token/records", requireMongo, async (request, response, next) => {
    const database = request.app.locals.mongoDatabase as MongoDatabase;
    const qrToken = String(request.params.token);
    const cookieId = request.cookies?.[SCOUTER_COOKIE];
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
      const competition = await findCompetitionByQrToken(database, qrToken);
      if (!competition) {
        response.status(404).json(errorResponse("Competition not found"));
        return;
      }
      const scouter = await findScouterByCookie(database, cookieId);
      const record = await createScoutRecord(
        database,
        competition._id,
        cookieId,
        parsed.data
      );
      response.status(201).json({
        record_id: record.record_id,
        scouter_name: scouter?.display_name ?? parsed.data.scouter_name
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/export/records.csv", async (_request, response, next) => {
    try {
      const exportData = await loadRecordExportData();
      if (!exportData) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const profile = await loadScoringProfile(profileStoragePath, exportData.scoringProfilePath);
      const csv = createRecordsCsv(exportData.records, profile);
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