import { describe, expect, it } from "vitest";
import {
  applyOfficialScoresToCsvRows,
  type CsvRowWithMatch
} from "./official-score-csv";

describe("applyOfficialScoresToCsvRows", () => {
  it("inserts red_score and blue_score columns using the per-match map", () => {
    const rows: CsvRowWithMatch[] = [
      { match_number: "Q1", team_number: "12" },
      { match_number: "Q2", team_number: "99" }
    ];
    const scores = new Map([
      ["Q1", { red_score: 110, blue_score: 95 }]
    ]);

    const result = applyOfficialScoresToCsvRows(rows, scores);

    expect(result[0].match_number).toBe("Q1");
    expect(result[0].red_score).toBe(110);
    expect(result[0].blue_score).toBe(95);
    expect(result[1].match_number).toBe("Q2");
    expect(result[1].red_score).toBe("");
    expect(result[1].blue_score).toBe("");
  });

  it("emits empty cells when the map is missing or empty", () => {
    const rows: CsvRowWithMatch[] = [{ match_number: "Q1", team_number: "12" }];
    expect(applyOfficialScoresToCsvRows(rows, new Map())).toEqual([
      { match_number: "Q1", team_number: "12", red_score: "", blue_score: "" }
    ]);
    expect(applyOfficialScoresToCsvRows(rows, undefined)).toEqual([
      { match_number: "Q1", team_number: "12", red_score: "", blue_score: "" }
    ]);
  });

  it("does not mutate the input row objects", () => {
    const row: CsvRowWithMatch = { match_number: "Q1", team_number: "12" };
    const before = JSON.stringify(row);
    applyOfficialScoresToCsvRows([row], new Map([["Q1", { red_score: 1, blue_score: 2 }]]));
    expect(JSON.stringify(row)).toBe(before);
  });
});