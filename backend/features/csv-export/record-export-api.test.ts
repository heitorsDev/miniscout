import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";

const exportProfile = {
  name: "export-profile",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    {
      key: "cycles",
      label: "Cycles",
      type: "counter",
      phase: "teleop",
      scoring_target: "basket",
      points_per_unit: 2
    },
    {
      key: "notes",
      label: "Notes",
      type: "note",
      phase: null
    },
    {
      key: "leave",
      label: "Leave",
      type: "boolean",
      phase: "auto",
      scoring_target: "mobility",
      points_per_unit: 3
    }
  ]
};

type ExportRecordFixture = {
  competition_id: string;
  match_number: string;
  team_number: string;
  scouter_name: string;
  submitted_at: Date;
  values: Record<string, unknown>;
};

function materializeFixtures(fixtures: ExportRecordFixture[]) {
  return fixtures.map((fixture, index) => ({
    _id: `rec_${index}`,
    scouter_cookie_id: `cookie_${index}`,
    ...fixture
  }));
}

describe("POST /api/admin/export/records.csv", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  async function appWithRecords(records: ExportRecordFixture[]) {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-export-"));
    temporaryDirectories.push(profileStoragePath);
    const scoringProfilePath = path.join(profileStoragePath, "export-profile.json");
    await writeFile(scoringProfilePath, JSON.stringify(exportProfile), "utf8");

    return createApp({
      profileStoragePath,
      loadRecordExportData: async () => ({
        scoringProfilePath,
        records: materializeFixtures(records)
      })
    });
  }

  it("exports required columns and profile fields in profile order", async () => {
    const app = await appWithRecords([
      {
        competition_id: "competition-1",
        match_number: "Q12",
        team_number: "254",
        scouter_name: "Ada",
        submitted_at: new Date("2026-07-29T12:34:56.000Z"),
        values: {
          leave: true,
          notes: "Fast",
          cycles: 4
        }
      }
    ]);

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.status).toBe(200);
    expect(response.text).toBe(
      "competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,cycles,notes,leave,estimated_score.total\r\n" +
      "competition-1,Q12,254,Ada,2026-07-29T12:34:56.000Z,,,4,Fast,true,11\r\n"
    );
  });

  it("marks the response as a CSV attachment", async () => {
    const app = await appWithRecords([]);

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.headers["content-type"]).toMatch(/^text\/csv(?:;|$)/);
    expect(response.headers["content-disposition"]).toBe("attachment; filename=\"records.csv\"");
  });

  it("escapes commas, quotes, and newlines in exported values", async () => {
    const app = await appWithRecords([
      {
        competition_id: "competition-1",
        match_number: "Q,12",
        team_number: "254",
        scouter_name: "Ada \"Ace\"",
        submitted_at: new Date("2026-07-29T12:34:56.000Z"),
        values: {
          cycles: 1,
          notes: "Quick, steady\nNo faults",
          leave: false
        }
      }
    ]);

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.text).toBe(
      "competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,cycles,notes,leave,estimated_score.total\r\n" +
      "competition-1,\"Q,12\",254,\"Ada \"\"Ace\"\"\",2026-07-29T12:34:56.000Z,,,1,\"Quick, steady\nNo faults\",false,2\r\n"
    );
  });

  it("exports one independently scored row per ScoutRecord", async () => {
    const app = await appWithRecords([
      {
        competition_id: "competition-1",
        match_number: "Q1",
        team_number: "111",
        scouter_name: "Grace",
        submitted_at: new Date("2026-07-29T10:00:00.000Z"),
        values: { cycles: 2, leave: false }
      },
      {
        competition_id: "competition-1",
        match_number: "Q2",
        team_number: "222",
        scouter_name: "Linus",
        submitted_at: new Date("2026-07-29T10:01:00.000Z"),
        values: { cycles: 5, leave: true }
      }
    ]);

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.text).toContain("competition-1,Q1,111,Grace,2026-07-29T10:00:00.000Z,,,2,,false,4\r\n");
    expect(response.text).toContain("competition-1,Q2,222,Linus,2026-07-29T10:01:00.000Z,,,5,,true,13\r\n");
  });

  it("returns the required header when no ScoutRecords exist", async () => {
    const app = await appWithRecords([]);

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.status).toBe(200);
    expect(response.text).toBe(
      "competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,cycles,notes,leave,estimated_score.total\r\n"
    );
  });

  it("returns 404 when no active Competition exists", async () => {
    const app = createApp({
      loadRecordExportData: async () => null
    });

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Competition not found" });
  });

  it("injects OfficialScore red_score and blue_score columns when a map is supplied", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-export-scores-"));
    temporaryDirectories.push(profileStoragePath);
    const scoringProfilePath = path.join(profileStoragePath, "export-profile.json");
    await writeFile(scoringProfilePath, JSON.stringify(exportProfile), "utf8");

    const app = createApp({
      profileStoragePath,
      loadRecordExportData: async () => ({
        scoringProfilePath,
        records: materializeFixtures([
          {
            competition_id: "competition-1",
            match_number: "Q12",
            team_number: "254",
            scouter_name: "Ada",
            submitted_at: new Date("2026-07-29T12:34:56.000Z"),
            values: { cycles: 4 }
          },
          {
            competition_id: "competition-1",
            match_number: "Q13",
            team_number: "254",
            scouter_name: "Ada",
            submitted_at: new Date("2026-07-29T12:35:56.000Z"),
            values: { cycles: 7 }
          }
        ]),
        officialScoresByMatch: new Map([
          ["Q12", { red_score: 110, blue_score: 95 }]
        ])
      })
    });

    const response = await request(app).post("/api/admin/export/records.csv");

    expect(response.status).toBe(200);
    const lines = response.text.trimEnd().split("\r\n");
    expect(lines[0]).toBe("competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,cycles,notes,leave,estimated_score.total");
    expect(lines[1]).toBe("competition-1,Q12,254,Ada,2026-07-29T12:34:56.000Z,110,95,4,,,8");
    expect(lines[2]).toBe("competition-1,Q13,254,Ada,2026-07-29T12:35:56.000Z,,,7,,,14");
  });
});
