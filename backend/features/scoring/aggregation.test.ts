import { describe, expect, it } from "vitest";
import { aggregateGroup } from "./aggregation";

const profile = {
  phases: ["auto"],
  fields: [
    { key: "count", type: "counter" as const, points_per_unit: 2 },
    { key: "distance", type: "number" as const, points_per_unit: 1 },
    { key: "left", type: "boolean" as const, points_per_unit: 3 },
    { key: "rating", type: "enum" as const, points_per_option: { low: 0, high: 4 } },
    { key: "notes", type: "note" as const }
  ]
};

const records = [
  { scouter_name: "Alice", values: { count: 1, distance: 2, left: true, rating: "high", notes: "fast" } },
  { scouter_name: "Bob", values: { count: 5, distance: 6, left: false, rating: "low", notes: "defense" } },
  { scouter_name: "Cara", values: { count: 3, distance: 4, left: true, rating: "high", notes: "steady" } }
];

describe("aggregateGroup", () => {
  it("aggregates each field according to its profile type", () => {
    expect(aggregateGroup(records, profile).fields).toEqual({
      count: { value: 3, no_consensus: false },
      distance: { value: 4, no_consensus: false },
      left: { value: true, no_consensus: false },
      rating: { value: "high", no_consensus: false },
      notes: { value: "Alice: fast\nBob: defense\nCara: steady", no_consensus: false }
    });
  });

  it("uses numeric median for odd and even record score totals", () => {
    expect(aggregateGroup(records, profile).total).toBe(16);
    expect(aggregateGroup(records.slice(0, 2), profile).total).toBe(13.5);
  });

  it("flags tied boolean and enum values as no consensus", () => {
    const result = aggregateGroup(records.slice(0, 2), profile);
    expect(result.fields.left).toEqual({ value: null, no_consensus: true });
    expect(result.fields.rating).toEqual({ value: null, no_consensus: true });
  });
});
