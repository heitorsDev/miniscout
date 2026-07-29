import path from "node:path";
import type { MongoDatabase } from "../../shared/db";
import type {
  OfficialScoreMap,
  RecordExportDataLoader,
  ScoutRecordForExport
} from "./csv.types";

type CreateLoaderOptions = {
  database: MongoDatabase;
  profileStoragePath: string;
};

export function createMongoRecordExportDataLoader(options: CreateLoaderOptions): RecordExportDataLoader {
  const { database, profileStoragePath } = options;
  return async () => {
    const competition = await database.collections.competitions.findOne(
      {
        $or: [
          { scoring_profile_path: { $exists: true } },
          { scoring_profile_name: { $exists: true } }
        ]
      },
      { sort: { created_at: -1, _id: -1 } }
    );
    if (!competition) {
      return null;
    }

    const scoringProfilePath = resolveScoringProfilePath(
      profileStoragePath,
      (competition as { scoring_profile_path?: string }).scoring_profile_path,
      competition.scoring_profile_name
    );

    const records = (await database.collections.records
      .find({ competition_id: competition._id })
      .sort({ submitted_at: 1, _id: 1 })
      .toArray()) as unknown as readonly ScoutRecordForExport[];

    const officialScores = await database.collections.official_scores
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
