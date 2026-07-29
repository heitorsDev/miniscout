import type { ScoutRecordDocument, OfficialScoreDocument } from "../../shared/db";

export type ScoutRecordForExport = ScoutRecordDocument;

export type OfficialScoreForExport = OfficialScoreDocument;

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