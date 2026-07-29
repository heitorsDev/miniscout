import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type Express } from "express";
import { profileNameSchema, validateScoringProfile, type ScoringProfile } from "./profile-schema";

type AppOptions = {
  profileStoragePath?: string;
};

function profilePath(profileStoragePath: string, name: string): string {
  const storagePath = path.resolve(profileStoragePath);
  const candidate = path.resolve(storagePath, `${name}.json`);
  if (!candidate.startsWith(`${storagePath}${path.sep}`)) {
    throw new Error("Profile path escapes storage directory");
  }
  return candidate;
}

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

export function createApp(options: AppOptions = {}): Express {
  const profileStoragePath = options.profileStoragePath ?? process.env.PROFILE_STORAGE_PATH ?? "/data/profiles";
  const app = express();

  app.use(express.json({ limit: "1mb" }));

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
