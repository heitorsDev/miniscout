import { z } from "zod";

export const matchNumberSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(20, "must be 20 characters or fewer");

export const scoreInputSchema = z.object({
  match_number: matchNumberSchema,
  red_score: z
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .finite("must be a finite number"),
  blue_score: z
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .finite("must be a finite number")
}).strict();

export const officialScoreUpsertSchema = z.object({
  competition_id: z.string().trim().min(1, "must be a non-empty string"),
  match_number: matchNumberSchema,
  red_score: scoreInputSchema.shape.red_score,
  blue_score: scoreInputSchema.shape.blue_score
}).strict();