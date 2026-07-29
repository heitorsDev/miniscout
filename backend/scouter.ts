import { z } from "zod";
import { newScouterId, type DraftDocument, type MongoDatabase, type ScouterDocument } from "./shared/db";

export const SCOUTER_COOKIE = "scouter_cookie_id";
export const SCOUTER_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

export const scouterNameSchema = z
  .string({ invalid_type_error: "must be a string" })
  .trim()
  .min(1, "must be a non-empty string")
  .max(60, "must be 60 characters or fewer");

export type ScouterNameInput = z.infer<typeof scouterNameSchema>;

export const draftInputSchema = z.object({
  scouter_name: scouterNameSchema,
  match_number: z.string(),
  team_number: z.string(),
  values: z.record(z.string(), z.unknown())
}).strict();

export type DraftInput = z.infer<typeof draftInputSchema>;

export type ScouterRegistration = {
  scouter_cookie_id: string;
  scouter_name: string;
};

export async function registerScouter(
  database: MongoDatabase,
  name: string,
  competitionToken: string
): Promise<ScouterRegistration> {
  const cookieId = newScouterId();
  const doc: ScouterDocument = {
    _id: cookieId,
    display_name: name,
    last_seen_at: new Date(),
    last_competition_token: competitionToken
  };
  await database.collections.scouters.insertOne(doc);
  return { scouter_cookie_id: cookieId, scouter_name: name };
}

export async function findScouterByCookie(
  database: MongoDatabase,
  cookieId: string
): Promise<ScouterDocument | null> {
  return database.collections.scouters.findOne({ _id: cookieId });
}

export async function upsertDraft(
  database: MongoDatabase,
  cookieId: string,
  competitionToken: string,
  draft: DraftInput
): Promise<DraftDocument> {
  const now = new Date();
  const doc: DraftDocument = {
    _id: `${cookieId}::${competitionToken}`,
    scouter_cookie_id: cookieId,
    competition_token: competitionToken,
    scouter_name: draft.scouter_name,
    match_number: draft.match_number,
    team_number: draft.team_number,
    values: draft.values,
    updated_at: now
  };
  await database.collections.drafts.replaceOne(
    { _id: doc._id },
    doc,
    { upsert: true }
  );
  return doc;
}

export async function loadDraft(
  database: MongoDatabase,
  cookieId: string,
  competitionToken: string
): Promise<DraftDocument | null> {
  return database.collections.drafts.findOne({
    _id: `${cookieId}::${competitionToken}`
  });
}
