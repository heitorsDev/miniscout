import { MongoClient, type Collection, type Db } from "mongodb";
import { randomBytes, randomUUID } from "node:crypto";

export type CompetitionDocument = {
  _id: string;
  name: string;
  scoring_profile_name: string;
  qr_token: string;
  lan_base_url: string;
  created_at: Date;
  current_match_number?: number;
};

export type ScouterDocument = {
  _id: string;
  display_name: string;
  last_seen_at: Date;
  last_competition_token?: string;
};

export type DraftDocument = {
  _id: string;
  competition_token: string;
  scouter_cookie_id: string;
  scouter_name: string;
  match_number: string;
  team_number: string;
  values: Record<string, unknown>;
  updated_at: Date;
};

export type ScoutRecordDocument = {
  _id: string;
  competition_id: string;
  match_number: string;
  team_number: string;
  scouter_name: string;
  scouter_cookie_id: string;
  values: Record<string, unknown>;
  submitted_at: Date;
};

export type Collections = {
  competitions: Collection<CompetitionDocument>;
  scouters: Collection<ScouterDocument>;
  drafts: Collection<DraftDocument>;
  records: Collection<ScoutRecordDocument>;
};

export type MongoDatabase = {
  client: MongoClient;
  db: Db;
  collections: Collections;
  close: () => Promise<void>;
};

export async function startMongoDatabase(url: string, databaseName = "miniscout"): Promise<MongoDatabase> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  const db = client.db(databaseName);
  const collections: Collections = {
    competitions: db.collection<CompetitionDocument>("competitions"),
    scouters: db.collection<ScouterDocument>("scouters"),
    drafts: db.collection<DraftDocument>("drafts"),
    records: db.collection<ScoutRecordDocument>("records")
  };
  await collections.competitions.createIndex({ qr_token: 1 }, { unique: true });
  await collections.competitions.createIndex({ created_at: -1 });
  await collections.records.createIndex({ competition_id: 1, submitted_at: -1 });
  await collections.drafts.createIndex(
    { scouter_cookie_id: 1, competition_token: 1 },
    { unique: true }
  );
  return {
    client,
    db,
    collections,
    close: async () => {
      await client.close();
    }
  };
}

export function newCompetitionId(): string {
  return `cmp_${randomUUID()}`;
}

export function newRecordId(): string {
  return `rec_${randomUUID()}`;
}

export function newScouterId(): string {
  return `sct_${randomBytes(16).toString("hex")}`;
}

export function newOpaqueToken(): string {
  return randomBytes(16).toString("hex");
}
