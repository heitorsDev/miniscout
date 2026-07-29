import { describe, expect, it } from "vitest";
import { createGroupsCsv } from "./group-export";

const profile = { phases: [], fields: [{ key: "count", type: "counter" as const, points_per_unit: 2 }] };

describe("createGroupsCsv", () => {
  it("exports one row per group with official score columns", () => {
    const csv = createGroupsCsv([
      { competition_id: "c", match_number: "1", team_number: "2", scouter_name: "A", submitted_at: "", values: { count: 1 } },
      { competition_id: "c", match_number: "1", team_number: "2", scouter_name: "B", submitted_at: "", values: { count: 3 } }
    ], profile, new Map([["1", { red_score: 12, blue_score: 9 }]]));
    expect(csv).toBe("match_number,team_number,record_count,aggregated_total,multi_scouted,red_score,blue_score\r\n1,2,2,4,true,12,9\r\n");
  });
});
