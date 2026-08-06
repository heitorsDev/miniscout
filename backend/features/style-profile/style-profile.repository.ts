import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StyleProfile } from "./style-profile.types";

const STYLE_PROFILE_FILE_NAME = "style-profile.json";

export function styleProfileFilePath(storagePath: string): string {
  return path.resolve(storagePath, STYLE_PROFILE_FILE_NAME);
}

export class StyleProfileNotFoundError extends Error {
  constructor() {
    super("StyleProfile has not been saved yet");
    this.name = "StyleProfileNotFoundError";
  }
}

export type StyleProfileRepository = {
  exists(): Promise<boolean>;
  load(): Promise<unknown>;
  loadRaw(): Promise<string>;
  save(profile: StyleProfile): Promise<void>;
};

export function createFileStyleProfileRepository(storagePath: string): StyleProfileRepository {
  return {
    async exists() {
      try {
        await readFile(styleProfileFilePath(storagePath), "utf8");
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return false;
        }
        throw error;
      }
    },
    async load() {
      try {
        const contents = await readFile(styleProfileFilePath(storagePath), "utf8");
        return JSON.parse(contents) as unknown;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          throw new StyleProfileNotFoundError();
        }
        throw error;
      }
    },
    async loadRaw() {
      try {
        return await readFile(styleProfileFilePath(storagePath), "utf8");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          throw new StyleProfileNotFoundError();
        }
        throw error;
      }
    },
    async save(profile) {
      await mkdir(storagePath, { recursive: true });
      const destination = styleProfileFilePath(storagePath);
      const temporaryPath = path.join(storagePath, `.${STYLE_PROFILE_FILE_NAME}.${randomUUID()}.tmp`);
      await writeFile(temporaryPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
      await rename(temporaryPath, destination);
    }
  };
}
