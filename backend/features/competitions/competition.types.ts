import type { z } from "zod";
import type { mintCompetitionSchema } from "./competition.schema";
import type { CompetitionDocument } from "../../shared/db";

export type MintCompetitionInput = z.infer<typeof mintCompetitionSchema>;

export type CompetitionView = {
  _id: string;
  name: string;
  scoring_profile_name: string;
  qr_token: string;
  qr_url: string;
  created_at: Date;
  current_match_number?: number;
};

export type MintCompetitionResult = {
  competition: CompetitionView;
  qr_url: string;
};

export type CompetitionWithToken = CompetitionDocument;