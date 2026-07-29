import { describe, expect, it } from "vitest";
import { createGroupsCsv } from "./group-export";

const profile = { phases: [], fields: [{ key: "count", type: "counter" as const, points_per_unit: 2 }] };

describe("createGroupsCsv", () => {
  it("exports one row per group without official score columns", () => {
    const csv = createGroupsCsv([
      { competition_id: "c", match_number: "1", team_number: "2", scouter_name: "A", values: { count: 1 } },
      { competition_id: "c", match_number: "1", team_number: "2", scouter_name: "B", values: { count: 3 } }
    ], profile);
    expect(csv).toBe("match_number,team_number,record_count,aggregated_total,multi_scouted\r\n1,2,2,4,true\r\n");
  });
});
