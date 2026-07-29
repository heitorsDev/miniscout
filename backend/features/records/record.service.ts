import type { RecordRepository } from "./record.repository";
import {
  buildScoutRecordDocument,
  findExistingScoutsFromDocs,
  summarizeGroup
} from "./record.repository";
import type { ScoringProfileInput } from "../scoring/scoring";
import { aggregateGroup } from "../scoring/aggregation";
import { calculateEstimatedScore } from "../scoring/scoring";
import {
  toScoutRecordView,
  type CreatedScoutRecord,
  type ExistingScoutsResult,
  type ScoutGroupDetail,
  type ScoutGroupSummary,
  type ScoutRecordInput
} from "./record.types";

export type RecordService = {
  createRecord(
    competitionId: string,
    cookieId: string,
    input: ScoutRecordInput
  ): Promise<CreatedScoutRecord>;
  deleteRecord(recordId: string): Promise<boolean>;
  listGroupsForCompetition(
    competitionId: string,
    profile: ScoringProfileInput
  ): Promise<ScoutGroupSummary[]>;
  getGroupForCompetition(
    competitionId: string,
    matchNumber: string,
    teamNumber: string,
    profile: ScoringProfileInput
  ): Promise<ScoutGroupDetail | null>;
  findExistingScouts(
    competitionId: string,
    matchNumber: string,
    teamNumber: string,
    excludedCookieId?: string
  ): Promise<ExistingScoutsResult>;
};

export function createRecordService(repository: RecordRepository): RecordService {
  return {
    async createRecord(competitionId, cookieId, input) {
      const doc = buildScoutRecordDocument(competitionId, cookieId, input);
      await repository.insert(doc);
      return { record_id: doc._id };
    },
    async deleteRecord(recordId) {
      return repository.deleteById(recordId);
    },
    async listGroupsForCompetition(competitionId, profile) {
      const docs = await repository.listByCompetition(competitionId);
      const grouped = new Map<string, typeof docs>();
      for (const doc of docs) {
        const key = `${doc.match_number}\u0000${doc.team_number}`;
        grouped.set(key, [...(grouped.get(key) ?? []), doc]);
      }
      return [...grouped.values()].map((records) =>
        summarizeGroup(records, aggregateGroup(records, profile).total)
      );
    },
    async getGroupForCompetition(competitionId, matchNumber, teamNumber, profile) {
      const docs = await repository.findByMatchTeam(competitionId, matchNumber, teamNumber);
      if (docs.length === 0) return null;
      return {
        match_number: matchNumber,
        team_number: teamNumber,
        record_count: docs.length,
        multi_scouted: docs.length >= 2,
        records: docs.map((doc) => ({
          ...toScoutRecordView(doc),
          estimated_score: calculateEstimatedScore(doc.values, profile)
        })),
        aggregated: aggregateGroup(docs, profile)
      };
    },
    async findExistingScouts(competitionId, matchNumber, teamNumber, excludedCookieId) {
      const docs = await repository.findByMatchTeam(competitionId, matchNumber, teamNumber);
      return findExistingScoutsFromDocs(docs, excludedCookieId);
    }
  };
}