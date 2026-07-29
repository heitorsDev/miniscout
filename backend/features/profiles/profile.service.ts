import { readFile } from "node:fs/promises";
import { ProfileNotFoundError, profilePath } from "./profile.repository";
import { validateScoringProfile } from "./profile.schema";
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
