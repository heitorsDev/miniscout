import { z } from "zod";
import { aggregateGroup } from "./features/scoring/aggregation";
import { calculateEstimatedScore, type ScoringProfileInput } from "./features/scoring/scoring";
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

export async function listGroupsForCompetitionAdmin(
  database: MongoDatabase,
  competitionId: string,
  profile: ScoringProfileInput
) {
  const docs = await database.collections.records.find({ competition_id: competitionId }).toArray();
  const grouped = new Map<string, ScoutRecordDocument[]>();
  for (const doc of docs) {
    const key = `${doc.match_number}\u0000${doc.team_number}`;
    grouped.set(key, [...(grouped.get(key) ?? []), doc]);
  }
  return [...grouped.values()].map((records) => ({
    match_number: records[0].match_number,
    team_number: records[0].team_number,
    record_count: records.length,
    multi_scouted: records.length >= 2,
    aggregated_total: aggregateGroup(records, profile).total
  }));
}

export async function getGroupForCompetitionAdmin(
  database: MongoDatabase,
  competitionId: string,
  matchNumber: string,
  teamNumber: string,
  profile: ScoringProfileInput
) {
  const docs = await database.collections.records.find({
    competition_id: competitionId,
    match_number: matchNumber,
    team_number: teamNumber
  }).sort({ submitted_at: 1 }).toArray();
  if (docs.length === 0) return null;
  return {
    match_number: matchNumber,
    team_number: teamNumber,
    record_count: docs.length,
    multi_scouted: docs.length >= 2,
    records: docs.map((doc) => ({
      ...toRecordView(doc),
      estimated_score: calculateEstimatedScore(doc.values, profile)
    })),
    aggregated: aggregateGroup(docs, profile)
  };
}

export async function findExistingScouts(
  database: MongoDatabase,
  competitionId: string,
  matchNumber: string,
  teamNumber: string,
  excludedCookieId?: string
) {
  const docs = await database.collections.records.find({ competition_id: competitionId, match_number: matchNumber, team_number: teamNumber }).toArray();
  return {
    count: docs.length,
    scouter_names: [...new Set(docs.filter((doc) => doc.scouter_cookie_id !== excludedCookieId).map((doc) => doc.scouter_name))]
  };
}

export async function deleteScoutRecord(
  database: MongoDatabase,
  recordId: string
): Promise<boolean> {
  const result = await database.collections.records.deleteOne({ _id: recordId });
  return result.deletedCount === 1;
}
