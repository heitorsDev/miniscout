import { z } from "zod";

export const scouterNameSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(60, "must be 60 characters or fewer");

export const draftInputSchema = z.object({
  scouter_name: scouterNameSchema,
  match_number: z.string(),
  team_number: z.string(),
  values: z.record(z.string(), z.unknown())
}).strict();