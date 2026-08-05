import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ScoringProfile } from "./profile.types";

export function profilePath(profileStoragePath: string, name: string): string {
  const storagePath = path.resolve(profileStoragePath);
  const candidate = path.resolve(storagePath, `${name}.json`);
  if (!candidate.startsWith(`${storagePath}${path.sep}`)) {
    throw new Error("Profile path escapes storage directory");
  }
  return candidate;
}

export class ProfileNotFoundError extends Error {
  constructor(public readonly profileName: string) {
    super(`ScoringProfile "${profileName}" not found`);
    this.name = "ProfileNotFoundError";
  }
}

export type ProfileRepository = {
  exists(name: string): Promise<boolean>;
  load(name: string): Promise<unknown>;
  loadRaw(name: string): Promise<string>;
  save(profile: ScoringProfile): Promise<void>;
  list(): Promise<string[]>;
};

export function createFileProfileRepository(storagePath: string): ProfileRepository {
  return {
    async exists(name) {
      try {
        await readFile(profilePath(storagePath, name), "utf8");
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return false;
        }
        throw error;
      }
    },
    async load(name) {
      try {
        const contents = await readFile(profilePath(storagePath, name), "utf8");
        return JSON.parse(contents) as unknown;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          throw new ProfileNotFoundError(name);
        }
        throw error;
      }
    },
    async loadRaw(name) {
      try {
        return await readFile(profilePath(storagePath, name), "utf8");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          throw new ProfileNotFoundError(name);
        }
        throw error;
      }
    },
    async save(profile) {
      await mkdir(storagePath, { recursive: true });
      const destination = profilePath(storagePath, profile.name);
      const temporaryPath = path.join(storagePath, `.${profile.name}.${randomUUID()}.tmp`);
      await writeFile(temporaryPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
      await rename(temporaryPath, destination);
    },
    async list() {
      let entries: string[];
      try {
        entries = await readdir(storagePath);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
      return entries
        .filter((entry) => !entry.startsWith(".") && entry.endsWith(".json"))
        .map((entry) => entry.slice(0, -".json".length))
        .sort();
    }
  };
}