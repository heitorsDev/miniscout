import { z } from "zod";

export const competitionNameSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(120, "must be 120 characters or fewer");

export const profileNameInputSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string");

export const lanBaseUrlSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .url("must be a valid URL");

export const mintCompetitionSchema = z.object({
  name: competitionNameSchema,
  scoring_profile_name: profileNameInputSchema,
  lan_base_url: lanBaseUrlSchema
}).strict();