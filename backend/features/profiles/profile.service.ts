import { readFile } from "node:fs/promises";
import { profilePath } from "./profile.repository";
import { validateScoringProfile } from "./profile.schema";
import type { ProfileValidationResult, ScoringProfile } from "./profile.types";

export async function loadProfileFromDisk(
  storagePath: string,
  name: string
): Promise<{ result: ProfileValidationResult } | { missing: true }> {
  try {
    const contents = await readFile(profilePath(storagePath, name), "utf8");
    return { result: validateScoringProfile(JSON.parse(contents)) };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { missing: true };
    }
    throw error;
  }
}

export async function loadValidatedProfile(
  storagePath: string,
  name: string
): Promise<ScoringProfile> {
  const loaded = await loadProfileFromDisk(storagePath, name);
  if ("missing" in loaded) {
    throw new Error(`ScoringProfile "${name}" not found`);
  }
  if (!loaded.result.success) {
    throw new Error("Competition references an invalid ScoringProfile");
  }
  return loaded.result.data;
}