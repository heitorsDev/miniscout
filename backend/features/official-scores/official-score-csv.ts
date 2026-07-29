import type { OfficialScoreMap } from "./record-export";

export type CsvRowWithMatch = {
  match_number: string;
  [column: string]: unknown;
};

export type CsvRowWithScores = CsvRowWithMatch & {
  red_score: number | "";
  blue_score: number | "";
};

export function applyOfficialScoresToCsvRows<T extends CsvRowWithMatch>(
  rows: readonly T[],
  scores: OfficialScoreMap | undefined
): Array<T & { red_score: number | ""; blue_score: number | "" }> {
  return rows.map((row) => {
    const entry = scores?.get(row.match_number);
    return {
      ...row,
      red_score: entry ? entry.red_score : "",
      blue_score: entry ? entry.blue_score : ""
    };
  });
}