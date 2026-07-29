import type { z } from "zod";
import type { scoringProfileSchema } from "./profile.schema";

export type ScoringProfile = z.infer<typeof scoringProfileSchema>;

export type ProfileValidationError = {
  path: string;
  message: string;
  code: string;
};

export type ProfileValidationResult =
  | { success: true; data: ScoringProfile }
  | { success: false; errors: ProfileValidationError[] };