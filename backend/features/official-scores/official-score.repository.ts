import { newOfficialScoreId, type MongoDatabase, type OfficialScoreDocument } from "../../shared/db";
import type { OfficialScoreView } from "./official-score.types";

export type OfficialScoreRepository = {
  upsert(input: {
    competition_id: string;
    match_number: string;
    red_score: number;
    blue_score: number;
  }): Promise<OfficialScoreDocument>;
  listByCompetition(competitionId: string): Promise<OfficialScoreDocument[]>;
  deleteByMatch(competitionId: string, matchNumber: string): Promise<boolean>;
};

export function createMongoOfficialScoreRepository(database: MongoDatabase): OfficialScoreRepository {
  return {
    async upsert(input) {
      const now = new Date();
      const filter = {
        competition_id: input.competition_id,
        match_number: input.match_number
      };
      const update = {
        $set: {
          red_score: input.red_score,
          blue_score: input.blue_score,
          updated_at: now
        },
        $setOnInsert: {
          _id: newOfficialScoreId(),
          competition_id: input.competition_id,
          match_number: input.match_number
        }
      };
      const options = { upsert: true, returnDocument: "after" as const };
      const result = await database.collections.official_scores.findOneAndUpdate(filter, update, options);
      if (!result) {
        throw new Error("OfficialScore upsert returned no document");
      }
      return result as OfficialScoreDocument;
    },
    async listByCompetition(competitionId) {
      return database.collections.official_scores
        .find({ competition_id: competitionId })
        .sort({ match_number: 1, updated_at: 1 })
        .toArray();
    },
    async deleteByMatch(competitionId, matchNumber) {
      const result = await database.collections.official_scores.deleteOne({
        competition_id: competitionId,
        match_number: matchNumber
      });
      return result.deletedCount === 1;
    }
  };
}

export function toOfficialScoreView(doc: OfficialScoreDocument): OfficialScoreView {
  return {
    _id: doc._id,
    competition_id: doc.competition_id,
    match_number: doc.match_number,
    red_score: doc.red_score,
    blue_score: doc.blue_score,
    updated_at: doc.updated_at
  };
}