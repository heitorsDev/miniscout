import type { z } from "zod";
import type { scoutRecordInputSchema } from "./record.schema";
import type { ScoutRecordDocument } from "../../shared/db";

export type ScoutRecordInput = z.infer<typeof scoutRecordInputSchema>;

export type ScoutRecordView = {
  _id: string;
  competition_id: string;
  match_number: string;
  team_number: string;
  scouter_name: string;
  scouter_cookie_id: string;
  values: Record<string, unknown>;
  submitted_at: string;
};

export type CreatedScoutRecord = {
  record_id: string;
};

export type ScoutGroupSummary = {
  match_number: string;
  team_number: string;
  record_count: number;
  multi_scouted: boolean;
  aggregated_total: number;
};

export type ScoutGroupDetail = {
  match_number: string;
  team_number: string;
  record_count: number;
  multi_scouted: boolean;
  records: Array<ScoutRecordView & { estimated_score: unknown }>;
  aggregated: unknown;
};

export type ExistingScoutsResult = {
  count: number;
  scouter_names: string[];
};

export function toScoutRecordView(doc: ScoutRecordDocument): ScoutRecordView {
  return {
    _id: doc._id,
    competition_id: doc.competition_id,
    match_number: doc.match_number,
    team_number: doc.team_number,
    scouter_name: doc.scouter_name,
    scouter_cookie_id: doc.scouter_cookie_id,
    values: doc.values,
    submitted_at: doc.submitted_at.toISOString()
  };
}