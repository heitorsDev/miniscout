import { z } from "zod";

export const scoutRecordInputSchema = z.object({
  scouter_name: z.string().trim().min(1, "must be a non-empty string").max(60),
  match_number: z.string().trim().min(1, "must be a non-empty string").max(20),
  team_number: z.string().trim().min(1, "must be a non-empty string").max(20),
  values: z.record(z.string(), z.unknown())
}).strict();