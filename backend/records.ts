import { z } from "zod";
import { newRecordId, type MongoDatabase, type ScoutRecordDocument } from "./db";

export const scoutRecordInputSchema = z.object({
  scouter_name: z.string().trim().min(1, "must be a non-empty string").max(60),
  match_number: z.string().trim().min(1, "must be a non-empty string").max(20),
  team_number: z.string().trim().min(1, "must be a non-empty string").max(20),
  values: z.record(z.string(), z.unknown())
}).strict();

export type ScoutRecordInput = z.infer<typeof scoutRecordInputSchema>;

export type CreatedScoutRecord = {
  record_id: string;
};

function toRecordView(doc: ScoutRecordDocument) {
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

export async function createScoutRecord(
  database: MongoDatabase,
  competitionId: string,
  cookieId: string,
  input: ScoutRecordInput
): Promise<CreatedScoutRecord> {
  const now = new Date();
  const doc: ScoutRecordDocument = {
    _id: newRecordId(),
    competition_id: competitionId,
    match_number: input.match_number,
    team_number: input.team_number,
    scouter_name: input.scouter_name,
    scouter_cookie_id: cookieId,
    values: input.values,
    submitted_at: now
  };
  await database.collections.records.insertOne(doc);
  return { record_id: doc._id };
}

export async function listRecordsForCompetitionAdmin(
  database: MongoDatabase,
  competitionId: string
) {
  const docs = await database.collections.records
    .find({ competition_id: competitionId })
    .sort({ submitted_at: -1 })
    .toArray();
  return docs.map(toRecordView);
}
