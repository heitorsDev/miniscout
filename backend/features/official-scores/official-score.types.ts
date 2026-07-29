import type { z } from "zod";
import type { officialScoreUpsertSchema } from "./official-score.schema";

export type OfficialScoreUpsertInput = z.infer<typeof officialScoreUpsertSchema>;

export type OfficialScoreView = {
  _id: string;
  competition_id: string;
  match_number: string;
  red_score: number;
  blue_score: number;
  updated_at: Date;
};