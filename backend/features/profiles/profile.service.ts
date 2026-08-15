import { readFile } from "node:fs/promises";
import { ProfileNotFoundError, profilePath } from "./profile.repository";
import type { ProfileRepository } from "./profile.repository";
import { validateScoringProfile } from "./profile.schema";
import { defaultReefscapeProfile } from "./reefscape.default";
import type { ScoringProfile } from "./profile.types";

export async function loadValidatedProfile(
  storagePath: string,
  name: string
): Promise<ScoringProfile> {
  let contents: string;
  try {
    contents = await readFile(profilePath(storagePath, name), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new ProfileNotFoundError(name);
    }
    throw error;
  }
  const result = validateScoringProfile(JSON.parse(contents));
  if (!result.success) {
    throw new Error("Competition references an invalid ScoringProfile");
  }
  return result.data;
}

/**
 * Seeds the bundled REEFSCAPE ScoringProfile on a fresh install so there's
 * something to mint/scout/score without an admin uploading one first. Only
 * runs when the storage directory has no profiles yet — never overwrites
 * or touches an existing installation.
 */
export async function seedDefaultProfileIfEmpty(repository: ProfileRepository): Promise<void> {
  const existing = await repository.list();
  if (existing.length > 0) {
    return;
  }
  await repository.save(defaultReefscapeProfile);
}
