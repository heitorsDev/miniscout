import { MongoClient } from "mongodb";
import path from "node:path";
import type {
  OfficialScoreMap,
  RecordExportDataLoader,
  ScoutRecordForExport
} from "./csv.types";

type CompetitionDocument = {
  _id: unknown;
  scoring_profile_path?: string;
  scoring_profile_name?: string;
  created_at?: Date;
};

type OfficialScoreDocument = {
  competition_id: unknown;
  match_number: string;
  red_score: number;
  blue_score: number;
};

type CreateLoaderOptions = {
  mongoUrl?: string;
  profileStoragePath: string;
};

export function createMongoRecordExportDataLoader(options: CreateLoaderOptions): RecordExportDataLoader {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/miniscout";
  const profileStoragePath = options.profileStoragePath;
  const client = new MongoClient(mongoUrl);
  let databasePromise: ReturnType<MongoClient["db"]> | Promise<ReturnType<MongoClient["db"]>> | undefined;

  const database = async () => {
    databasePromise ??= client.connect().then(() => client.db());
    return databasePromise;
  };

  return async () => {
    const db = await database();
    const competition = await db.collection<CompetitionDocument>("competitions").findOne(
      {
        $or: [
          { scoring_profile_path: { $type: "string" } },
          { scoring_profile_name: { $type: "string" } }
        ]
      },
      { sort: { created_at: -1, _id: -1 } }
    );
    if (!competition) {
      return null;
    }

    const scoringProfilePath = resolveScoringProfilePath(
      profileStoragePath,
      competition.scoring_profile_path,
      competition.scoring_profile_name
    );

    const candidateCollections = ["scout_records", "records"];
    let records: readonly ScoutRecordForExport[] = [];
    for (const collectionName of candidateCollections) {
      const docs = await db.collection<ScoutRecordForExport>(collectionName)
        .find({ competition_id: competition._id })
        .sort({ submitted_at: 1, _id: 1 })
        .toArray();
      if (docs.length > 0) {
        records = docs;
        break;
      }
    }

    const officialScores = await db.collection<OfficialScoreDocument>("official_scores")
      .find({ competition_id: competition._id })
      .toArray();
    const officialScoresByMatch: OfficialScoreMap = new Map(
      officialScores.map((doc) => [doc.match_number, { red_score: doc.red_score, blue_score: doc.blue_score }])
    );

    return {
      scoringProfilePath,
      records,
      officialScoresByMatch
    };
  };
}

function resolveScoringProfilePath(
  profileStoragePath: string,
  absolutePath: string | undefined,
  filename: string | undefined
): string {
  if (absolutePath !== undefined) {
    return absolutePath;
  }
  if (filename === undefined) {
    throw new Error("Competition has no ScoringProfile reference");
  }
  return path.join(profileStoragePath, filename.endsWith(".json") ? filename : `${filename}.json`);
}