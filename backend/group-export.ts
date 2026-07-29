import { aggregateGroup } from "./features/scoring/aggregation";
import { applyOfficialScoresToCsvRows } from "./features/official-scores/official-score-csv";
import type { ScoringProfileInput } from "./features/scoring/scoring";
import type { OfficialScoreMap, ScoutRecordForExport } from "./record-export";

export function createGroupsCsv(
  records: readonly ScoutRecordForExport[],
  profile: ScoringProfileInput,
  officialScoresByMatch?: OfficialScoreMap
): string {
  const groups = new Map<string, ScoutRecordForExport[]>();
  for (const record of records) {
    const key = `${String(record.match_number)}\u0000${String(record.team_number)}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const rows = [...groups.values()].map((group) => {
    const aggregation = aggregateGroup(group.map((record) => ({
      scouter_name: String(record.scouter_name),
      values: typeof record.values === "object" && record.values !== null && !Array.isArray(record.values) ? record.values as Record<string, unknown> : {}
    })), profile);
    return {
      match_number: String(group[0].match_number),
      team_number: String(group[0].team_number),
      record_count: group.length,
      aggregated_total: aggregation.total,
      multi_scouted: group.length >= 2
    };
  });
  const rowsWithScores = applyOfficialScoresToCsvRows(rows, officialScoresByMatch);
  const lines = rowsWithScores.map((row) => [
    row.match_number,
    row.team_number,
    row.record_count,
    row.aggregated_total,
    row.multi_scouted,
    row.red_score,
    row.blue_score
  ].join(","));
  return `match_number,team_number,record_count,aggregated_total,multi_scouted,red_score,blue_score\r\n${lines.map((row) => `${row}\r\n`).join("")}`;
}
