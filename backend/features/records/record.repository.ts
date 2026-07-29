import { newRecordId, type MongoDatabase, type ScoutRecordDocument } from "../../shared/db";
import type { ExistingScoutsResult, ScoutGroupSummary } from "./record.types";

export type RecordRepository = {
  insert(doc: ScoutRecordDocument): Promise<void>;
  listByCompetition(competitionId: string): Promise<ScoutRecordDocument[]>;
  findByMatchTeam(
    competitionId: string,
    matchNumber: string,
    teamNumber: string
  ): Promise<ScoutRecordDocument[]>;
  deleteById(recordId: string): Promise<boolean>;
};

export function createMongoRecordRepository(database: MongoDatabase): RecordRepository {
  return {
    async insert(doc) {
      await database.collections.records.insertOne(doc);
    },
    async listByCompetition(competitionId) {
      return database.collections.records.find({ competition_id: competitionId }).toArray();
    },
    async findByMatchTeam(competitionId, matchNumber, teamNumber) {
      return database.collections.records
        .find({ competition_id: competitionId, match_number: matchNumber, team_number: teamNumber })
        .sort({ submitted_at: 1 })
        .toArray();
    },
    async deleteById(recordId) {
      const result = await database.collections.records.deleteOne({ _id: recordId });
      return result.deletedCount === 1;
    }
  };
}

export function buildScoutRecordDocument(
  competitionId: string,
  cookieId: string,
  input: { match_number: string; team_number: string; scouter_name: string; values: Record<string, unknown> }
): ScoutRecordDocument {
  return {
    _id: newRecordId(),
    competition_id: competitionId,
    match_number: input.match_number,
    team_number: input.team_number,
    scouter_name: input.scouter_name,
    scouter_cookie_id: cookieId,
    values: input.values,
    submitted_at: new Date()
  };
}

export function findExistingScoutsFromDocs(
  docs: readonly ScoutRecordDocument[],
  excludedCookieId?: string
): ExistingScoutsResult {
  return {
    count: docs.length,
    scouter_names: [
      ...new Set(
        docs
          .filter((doc) => doc.scouter_cookie_id !== excludedCookieId)
          .map((doc) => doc.scouter_name)
      )
    ]
  };
}

export function summarizeGroup(
  docs: readonly ScoutRecordDocument[],
  aggregatedTotal: number
): ScoutGroupSummary {
  return {
    match_number: docs[0].match_number,
    team_number: docs[0].team_number,
    record_count: docs.length,
    multi_scouted: docs.length >= 2,
    aggregated_total: aggregatedTotal
  };
}