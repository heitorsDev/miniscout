import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateScoringProfile, type ScoringProfile } from "./profile-schema";
import { calculateEstimatedScore, type RecordValues } from "./scoring";

export type ScoutRecordForExport = {
  competition_id: unknown;
  match_number: unknown;
  team_number: unknown;
  scouter_name: unknown;
  submitted_at: unknown;
  values?: unknown;
};

export type OfficialScoreMapEntry = {
  red_score: number;
  blue_score: number;
};

export type OfficialScoreMap = ReadonlyMap<string, OfficialScoreMapEntry>;

export type RecordExportData = {
  scoringProfilePath: string;
  records: readonly ScoutRecordForExport[];
  officialScoresByMatch?: OfficialScoreMap;
};

export type RecordExportDataLoader = () => Promise<RecordExportData | null>;

function resolveProfileReference(profileStoragePath: string, scoringProfilePath: string): string {
  const storagePath = path.resolve(profileStoragePath);
  const candidate = path.resolve(
    path.isAbsolute(scoringProfilePath)
      ? scoringProfilePath
      : path.join(storagePath, scoringProfilePath)
  );
  if (!candidate.startsWith(`${storagePath}${path.sep}`)) {
    throw new Error("Profile path escapes storage directory");
  }
  return candidate;
}

export async function loadScoringProfile(
  profileStoragePath: string,
  scoringProfilePath: string
): Promise<ScoringProfile> {
  const contents = await readFile(resolveProfileReference(profileStoragePath, scoringProfilePath), "utf8");
  const parsed = JSON.parse(contents) as unknown;
  const result = validateScoringProfile(parsed);
  if (!result.success) {
    throw new Error("Competition references an invalid ScoringProfile");
  }
  return result.data;
}

function recordValues(value: unknown): RecordValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as RecordValues;
}

function documentValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return String(value);
}

function rawFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value) ?? "";
  }
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function csvRow(values: readonly string[]): string {
  return values.map(escapeCsvCell).join(",");
}

export function createRecordsCsv(
  records: readonly ScoutRecordForExport[],
  profile: ScoringProfile,
  officialScoresByMatch?: OfficialScoreMap
): string {
  const header = [
    "competition_id",
    "match_number",
    "team_number",
    "scouter_name",
    "submitted_at",
    "red_score",
    "blue_score",
    ...profile.fields.map((field) => field.key),
    "estimated_score.total"
  ];
  const rows = records.map((record) => {
    const values = recordValues(record.values);
    const matchKey = documentValue(record.match_number);
    const scores = officialScoresByMatch?.get(matchKey);
    return [
      documentValue(record.competition_id),
      matchKey,
      documentValue(record.team_number),
      documentValue(record.scouter_name),
      documentValue(record.submitted_at),
      scores ? String(scores.red_score) : "",
      scores ? String(scores.blue_score) : "",
      ...profile.fields.map((field) => rawFieldValue(values[field.key])),
      String(calculateEstimatedScore(values, profile).total)
    ];
  });

  return `${[header, ...rows].map(csvRow).join("\r\n")}\r\n`;
}
