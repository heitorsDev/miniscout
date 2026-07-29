import type { MongoDatabase, ScoutRecordDocument } from "../../shared/db";

export type TeamRepository = {
  listByCompetition(competitionId: string): Promise<ScoutRecordDocument[]>;
};

export function createMongoTeamRepository(database: MongoDatabase): TeamRepository {
  return {
    async listByCompetition(competitionId) {
      return database.collections.records
        .find({ competition_id: competitionId })
        .sort({ match_number: 1, team_number: 1, submitted_at: 1 })
        .toArray();
    }
  };
}
