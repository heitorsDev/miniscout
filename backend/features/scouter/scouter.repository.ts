import { newScouterId, type DraftDocument, type MongoDatabase, type ScouterDocument } from "../../shared/db";
import type { DraftInput } from "./scouter.types";

export type ScouterRepository = {
  insertScouter(doc: ScouterDocument): Promise<void>;
  findScouterByCookie(cookieId: string): Promise<ScouterDocument | null>;
  upsertDraft(doc: DraftDocument): Promise<void>;
  loadDraft(cookieId: string, competitionToken: string): Promise<DraftDocument | null>;
};

export function createMongoScouterRepository(database: MongoDatabase): ScouterRepository {
  return {
    async insertScouter(doc) {
      await database.collections.scouters.insertOne(doc);
    },
    async findScouterByCookie(cookieId) {
      return database.collections.scouters.findOne({ _id: cookieId });
    },
    async upsertDraft(doc) {
      await database.collections.drafts.replaceOne({ _id: doc._id }, doc, { upsert: true });
    },
    async loadDraft(cookieId, competitionToken) {
      return database.collections.drafts.findOne({ _id: `${cookieId}::${competitionToken}` });
    }
  };
}

export function buildScouterDocument(name: string, competitionToken: string): ScouterDocument {
  return {
    _id: newScouterId(),
    display_name: name,
    last_seen_at: new Date(),
    last_competition_token: competitionToken
  };
}

export function buildDraftDocument(
  cookieId: string,
  competitionToken: string,
  draft: DraftInput
): DraftDocument {
  return {
    _id: `${cookieId}::${competitionToken}`,
    scouter_cookie_id: cookieId,
    competition_token: competitionToken,
    scouter_name: draft.scouter_name,
    match_number: draft.match_number,
    team_number: draft.team_number,
    values: draft.values,
    updated_at: new Date()
  };
}