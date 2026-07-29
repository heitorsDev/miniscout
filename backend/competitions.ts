import { z } from "zod";
import { newCompetitionId, newOpaqueToken, type CompetitionDocument, type MongoDatabase } from "./db";

export const competitionNameSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(120, "must be 120 characters or fewer");

export const profileNameInputSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string");

export const lanBaseUrlSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .url("must be a valid URL");

export const mintCompetitionSchema = z.object({
  name: competitionNameSchema,
  scoring_profile_name: profileNameInputSchema,
  lan_base_url: lanBaseUrlSchema
}).strict();

export type MintCompetitionInput = z.infer<typeof mintCompetitionSchema>;

export type MintCompetitionResult = {
  competition: {
    _id: string;
    name: string;
    scoring_profile_name: string;
    qr_token: string;
    created_at: Date;
    current_match_number?: number;
  };
  qr_url: string;
};

function toCompetitionView(doc: CompetitionDocument) {
  return {
    _id: doc._id,
    name: doc.name,
    scoring_profile_name: doc.scoring_profile_name,
    qr_token: doc.qr_token,
    created_at: doc.created_at,
    ...(doc.current_match_number !== undefined ? { current_match_number: doc.current_match_number } : {})
  };
}

export async function mintCompetition(
  database: MongoDatabase,
  input: MintCompetitionInput
): Promise<MintCompetitionResult> {
  const now = new Date();
  const doc: CompetitionDocument = {
    _id: newCompetitionId(),
    name: input.name,
    scoring_profile_name: input.scoring_profile_name,
    qr_token: newOpaqueToken(),
    lan_base_url: input.lan_base_url,
    created_at: now
  };
  await database.collections.competitions.insertOne(doc);
  const url = new URL(input.lan_base_url);
  url.pathname = "/scout";
  url.search = `?c=${doc.qr_token}`;
  return {
    competition: toCompetitionView(doc),
    qr_url: url.toString()
  };
}

export async function findCompetitionByQrToken(
  database: MongoDatabase,
  qrToken: string
): Promise<CompetitionDocument | null> {
  return database.collections.competitions.findOne({ qr_token: qrToken });
}

export async function findCompetitionById(
  database: MongoDatabase,
  id: string
): Promise<CompetitionDocument | null> {
  return database.collections.competitions.findOne({ _id: id });
}

export async function listCompetitionsAdmin(database: MongoDatabase) {
  const docs = await database.collections.competitions
    .find({}, { projection: { lan_base_url: 0 } })
    .sort({ created_at: -1 })
    .toArray();
  return docs.map(toCompetitionView);
}
