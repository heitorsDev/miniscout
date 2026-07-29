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