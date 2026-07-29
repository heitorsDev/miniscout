import { readFile } from "node:fs/promises";
import { profilePath } from "./profile-storage";

export class ProfileNotFoundError extends Error {
  constructor(public readonly profileName: string) {
    super(`ScoringProfile "${profileName}" not found`);
    this.name = "ProfileNotFoundError";
  }
}

export type ProfileLookup = {
  exists(name: string): Promise<boolean>;
  load(name: string): Promise<unknown>;
};

export function createProfileLookup(storagePath: string): ProfileLookup {
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
    }
  };
}
