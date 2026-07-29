import { describe, expect, it } from "vitest";
import {
  buildTeamRollups,
  median,
  type ScoutRecordForRollup
} from "./team-rollup";

function rec(overrides: Partial<ScoutRecordForRollup>): ScoutRecordForRollup {
  return {
    _id: "rec_x",
    match_number: "1",
    team_number: "100",
    values: {},
    ...overrides
  };
}

describe("median", () => {
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for odd-length lists", () => {
    expect(median([1, 5, 9])).toBe(5);
  });

  it("returns the average of the two middle values for even-length lists", () => {
    expect(median([1, 5, 9, 13])).toBe(7);
    expect(median([2, 4])).toBe(3);
  });

  it("ignores non-finite entries", () => {
    expect(median([Number.NaN, 2, 4])).toBe(3);
    expect(median([2, Number.POSITIVE_INFINITY, 4])).toBe(3);
  });
});

describe("buildTeamRollups", () => {
  it("returns an empty list when no records are given", () => {
    expect(buildTeamRollups([], null)).toEqual([]);
  });

  it("groups records by team_number and computes per-match medians", () => {
    const records: ScoutRecordForRollup[] = [
      rec({ _id: "r1", team_number: "100", match_number: "Q1", values: { cycles: 5 } }),
      rec({ _id: "r2", team_number: "100", match_number: "Q1", values: { cycles: 7 } }),
      rec({ _id: "r3", team_number: "100", match_number: "Q2", values: { cycles: 1 } })
    ];

    const rollups = buildTeamRollups(records, {
      fields: [
        { key: "cycles", type: "counter", phase: null, points_per_unit: 1 }
      ],
      phases: []
    });

    expect(rollups).toHaveLength(1);
    expect(rollups[0].team_number).toBe("100");
    expect(rollups[0].record_count).toBe(3);
    expect(rollups[0].matches_scouted).toEqual(["Q1", "Q2"]);
    expect(rollups[0].matches).toEqual([
      { match_number: "Q1", record_count: 2, median_estimated_score: 6 },
      { match_number: "Q2", record_count: 1, median_estimated_score: 1 }
    ]);
  });

  it("averages the middle pair for even-length per-match groups", () => {
    const records: ScoutRecordForRollup[] = [
      rec({ _id: "r1", team_number: "100", match_number: "Q1", values: { cycles: 4 } }),
      rec({ _id: "r2", team_number: "100", match_number: "Q1", values: { cycles: 6 } }),
      rec({ _id: "r3", team_number: "100", match_number: "Q1", values: { cycles: 8 } }),
      rec({ _id: "r4", team_number: "100", match_number: "Q1", values: { cycles: 10 } })
    ];

    const rollups = buildTeamRollups(records, {
      fields: [
        { key: "cycles", type: "counter", phase: null, points_per_unit: 1 }
      ],
      phases: []
    });

    expect(rollups[0].matches[0].median_estimated_score).toBe(7);
    expect(rollups[0].matches[0].record_count).toBe(4);
  });

  it("emits one rollup per team, sorted alphabetically by team_number", () => {
    const records: ScoutRecordForRollup[] = [
      rec({ _id: "r1", team_number: "999", match_number: "Q1", values: {} }),
      rec({ _id: "r2", team_number: "12", match_number: "Q1", values: {} }),
      rec({ _id: "r3", team_number: "5", match_number: "Q1", values: {} })
    ];

    const rollups = buildTeamRollups(records, null);
    expect(rollups.map((r) => r.team_number)).toEqual(["12", "5", "999"]);
  });

  it("sorts matches within a team by match_number", () => {
    const records: ScoutRecordForRollup[] = [
      rec({ _id: "r1", team_number: "100", match_number: "Q3", values: {} }),
      rec({ _id: "r2", team_number: "100", match_number: "Q1", values: {} }),
      rec({ _id: "r3", team_number: "100", match_number: "Q2", values: {} })
    ];

    const rollups = buildTeamRollups(records, null);
    expect(rollups[0].matches_scouted).toEqual(["Q1", "Q2", "Q3"]);
  });
});