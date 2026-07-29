import type { OfficialScoreRepository } from "./official-score.repository";
import { toOfficialScoreView } from "./official-score.repository";
import type { OfficialScoreUpsertInput, OfficialScoreView } from "./official-score.types";

export type OfficialScoreService = {
  upsertScore(input: OfficialScoreUpsertInput): Promise<OfficialScoreView>;
  listScores(competitionId: string): Promise<OfficialScoreView[]>;
};

export function createOfficialScoreService(repository: OfficialScoreRepository): OfficialScoreService {
  return {
    async upsertScore(input) {
      const doc = await repository.upsert(input);
      return toOfficialScoreView(doc);
    },
    async listScores(competitionId) {
      const docs = await repository.listByCompetition(competitionId);
      return docs.map(toOfficialScoreView);
    }
  };
}