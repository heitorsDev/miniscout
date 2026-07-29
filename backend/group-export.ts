import { aggregateGroup } from "./aggregation";
import type { ScoringProfileInput } from "./scoring";
import type { ScoutRecordForExport } from "./record-export";

export function createGroupsCsv(records: readonly ScoutRecordForExport[], profile: ScoringProfileInput): string {
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
    return [String(group[0].match_number), String(group[0].team_number), String(group.length), String(aggregation.total), String(group.length >= 2)].join(",");
  });
  return `match_number,team_number,record_count,aggregated_total,multi_scouted\r\n${rows.map((row) => `${row}\r\n`).join("")}`;
}
