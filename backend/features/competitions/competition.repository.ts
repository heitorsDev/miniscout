import { newCompetitionId, newOpaqueToken, type CompetitionDocument, type MongoDatabase } from "../../shared/db";
import type { CompetitionView, MintCompetitionInput, MintCompetitionResult } from "./competition.types";

function toCompetitionView(doc: CompetitionDocument): CompetitionView {
  return {
    _id: doc._id,
    name: doc.name,
    scoring_profile_name: doc.scoring_profile_name,
    qr_token: doc.qr_token,
    created_at: doc.created_at,
    ...(doc.current_match_number !== undefined ? { current_match_number: doc.current_match_number } : {})
  };
}

export type CompetitionRepository = {
  insert(doc: CompetitionDocument): Promise<void>;
  findByQrToken(qrToken: string): Promise<CompetitionDocument | null>;
  findById(id: string): Promise<CompetitionDocument | null>;
  list(): Promise<CompetitionView[]>;
};

export function createMongoCompetitionRepository(database: MongoDatabase): CompetitionRepository {
  return {
    async insert(doc) {
      await database.collections.competitions.insertOne(doc);
    },
    async findByQrToken(qrToken) {
      return database.collections.competitions.findOne({ qr_token: qrToken });
    },
    async findById(id) {
      return database.collections.competitions.findOne({ _id: id });
    },
    async list() {
      const docs = await database.collections.competitions
        .find({}, { projection: { lan_base_url: 0 } })
        .sort({ created_at: -1 })
        .toArray();
      return docs.map(toCompetitionView);
    }
  };
}

export function mintCompetitionFromInput(input: MintCompetitionInput): {
  document: CompetitionDocument;
  qr_url: string;
} {
  const now = new Date();
  const doc: CompetitionDocument = {
    _id: newCompetitionId(),
    name: input.name,
    scoring_profile_name: input.scoring_profile_name,
    qr_token: newOpaqueToken(),
    lan_base_url: input.lan_base_url,
    created_at: now
  };
  const url = new URL(input.lan_base_url);
  url.pathname = "/scout";
  url.search = `?c=${doc.qr_token}`;
  return { document: doc, qr_url: url.toString() };
}

export function viewCompetition(doc: CompetitionDocument): CompetitionView {
  return toCompetitionView(doc);
}

export { mintCompetitionFromInput as mintCompetitionFactory };

export type MintCompetitionFactory = typeof mintCompetitionFromInput;