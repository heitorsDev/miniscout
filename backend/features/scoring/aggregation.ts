import { calculateEstimatedScore, type ScoringProfileInput } from "./scoring";

export type GroupRecord = {
  scouter_name: string;
  values: Readonly<Record<string, unknown>>;
};

export type AggregatedField = {
  value: unknown;
  no_consensus: boolean;
};

export type GroupAggregation = {
  fields: Record<string, AggregatedField>;
  total: number;
};

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function mode(values: readonly unknown[]): AggregatedField {
  const counts = new Map<unknown, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const highest = Math.max(0, ...counts.values());
  const winners = [...counts.entries()].filter(([, count]) => count === highest);
  return winners.length === 1
    ? { value: winners[0][0], no_consensus: false }
    : { value: null, no_consensus: true };
}

export function aggregateGroup(
  records: readonly GroupRecord[],
  profile: ScoringProfileInput
): GroupAggregation {
  const fields: Record<string, AggregatedField> = {};
  for (const field of profile.fields) {
    const values = records.map((record) => record.values[field.key]);
    if (field.type === "counter" || field.type === "number") {
      fields[field.key] = {
        value: median(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))),
        no_consensus: false
      };
    } else if (field.type === "boolean" || field.type === "enum") {
      fields[field.key] = mode(values);
    } else {
      fields[field.key] = {
        value: records
          .filter((record) => typeof record.values[field.key] === "string" && record.values[field.key] !== "")
          .map((record) => `${record.scouter_name}: ${record.values[field.key]}`)
          .join("\n"),
        no_consensus: false
      };
    }
  }
  return {
    fields,
    total: median(records.map((record) => calculateEstimatedScore(record.values, profile).total))
  };
}
