import { z } from "zod";
import { newOfficialScoreId, type MongoDatabase, type OfficialScoreDocument } from "./shared/db";

export const matchNumberSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(20, "must be 20 characters or fewer");

export const scoreInputSchema = z.object({
  match_number: matchNumberSchema,
  red_score: z
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .finite("must be a finite number"),
  blue_score: z
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .finite("must be a finite number")
}).strict();

export const officialScoreUpsertSchema = z.object({
  competition_id: z.string().trim().min(1, "must be a non-empty string"),
  match_number: matchNumberSchema,
  red_score: scoreInputSchema.shape.red_score,
  blue_score: scoreInputSchema.shape.blue_score
}).strict();

export type OfficialScoreUpsertInput = z.infer<typeof officialScoreUpsertSchema>;

export type OfficialScoreView = {
  _id: string;
  competition_id: string;
  match_number: string;
  red_score: number;
  blue_score: number;
  updated_at: Date;
};

export { newOfficialScoreId };

function toView(doc: OfficialScoreDocument): OfficialScoreView {
  return {
    _id: doc._id,
    competition_id: doc.competition_id,
    match_number: doc.match_number,
    red_score: doc.red_score,
    blue_score: doc.blue_score,
    updated_at: doc.updated_at
  };
}

export async function upsertOfficialScore(
  database: MongoDatabase,
  input: OfficialScoreUpsertInput
): Promise<OfficialScoreView> {
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
  return toView(result as OfficialScoreDocument);
}

export async function listOfficialScoresForCompetition(
  database: MongoDatabase,
  competitionId: string
): Promise<OfficialScoreView[]> {
  const docs = await database.collections.official_scores
    .find({ competition_id: competitionId })
    .sort({ match_number: 1, updated_at: 1 })
    .toArray();
  return docs.map(toView);
}

export async function deleteOfficialScoreForMatch(
  database: MongoDatabase,
  competitionId: string,
  matchNumber: string
): Promise<boolean> {
  const result = await database.collections.official_scores.deleteOne({
    competition_id: competitionId,
    match_number: matchNumber
  });
  return result.deletedCount === 1;
}