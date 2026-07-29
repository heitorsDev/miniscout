import type { RecordRepository } from "./record.repository";
import {
  buildScoutRecordDocument,
  findExistingScoutsFromDocs,
  summarizeGroup
} from "./record.repository";
import type { ScoringProfileInput } from "../scoring/scoring";
import { aggregateGroup } from "../scoring/aggregation";
import { calculateEstimatedScore } from "../scoring/scoring";
import { loadValidatedProfile } from "../profiles/profile.service";
import type { ScouterService } from "../scouter/scouter.service";
import type { CompetitionDocument } from "../../shared/db";
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
    competition: CompetitionDocument
  ): Promise<ScoutGroupSummary[]>;
  getGroupForCompetition(
    competition: CompetitionDocument,
    matchNumber: string,
    teamNumber: string
  ): Promise<ScoutGroupDetail | null>;
  findExistingScouts(
    competitionId: string,
    matchNumber: string,
    teamNumber: string,
    excludedCookieId?: string
  ): Promise<ExistingScoutsResult>;
  loadProfileForCompetition(competition: CompetitionDocument): Promise<ScoringProfileInput>;
};

export type RecordServiceDeps = {
  repository: RecordRepository;
  scouterService: ScouterService;
  profileStoragePath: string;
};

export function createRecordService(deps: RecordServiceDeps): RecordService {
  const { repository, scouterService, profileStoragePath } = deps;
  const loadProfile = (competition: CompetitionDocument) =>
    loadValidatedProfile(profileStoragePath, competition.scoring_profile_name) as Promise<ScoringProfileInput>;
  return {
    loadProfileForCompetition: loadProfile,
    async createRecord(competitionId, cookieId, input) {
      const doc = buildScoutRecordDocument(competitionId, cookieId, input);
      await repository.insert(doc);
      const scouter = await scouterService.findScouterByCookie(cookieId);
      return {
        record_id: doc._id,
        scouter_name: scouter?.display_name ?? input.scouter_name
      };
    },
    async deleteRecord(recordId) {
      return repository.deleteById(recordId);
    },
    async listGroupsForCompetition(competition) {
      const profile = await loadProfile(competition);
      const docs = await repository.listByCompetition(competition._id);
      const grouped = new Map<string, typeof docs>();
      for (const doc of docs) {
        const key = `${doc.match_number}\u0000${doc.team_number}`;
        grouped.set(key, [...(grouped.get(key) ?? []), doc]);
      }
      return [...grouped.values()].map((records) =>
        summarizeGroup(records, aggregateGroup(records, profile).total)
      );
    },
    async getGroupForCompetition(competition, matchNumber, teamNumber) {
      const profile = await loadProfile(competition);
      const docs = await repository.findByMatchTeam(competition._id, matchNumber, teamNumber);
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
