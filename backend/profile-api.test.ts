import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

const validProfile = {
  name: "rapid-recycle",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    {
      key: "auto_notes",
      label: "Autonomous notes",
      type: "note",
      phase: "auto"
    },
    {
      key: "pieces_scored",
      label: "Pieces scored",
      type: "counter",
      phase: "teleop",
      scoring_target: "team",
      points_per_unit: 2
    },
    {
      key: "leave",
      label: "Left starting area",
      type: "boolean",
      phase: "auto",
      points_per_unit: 3
    },
    {
      key: "cycle_quality",
      label: "Cycle quality",
      type: "enum",
      phase: "teleop",
      points_per_option: {
        low: 0,
        high: 4
      }
    },
    {
      key: "endgame_time",
      label: "Endgame time",
      type: "number",
      phase: "teleop",
      points_per_unit: 1.5
    }
  ]
};

describe("admin Profile API", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("accepts valid ScoringProfile JSON and persists it at configured path", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    const response = await request(app).post("/api/admin/profiles").send(validProfile);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(validProfile);
    await expect(readFile(path.join(profileStoragePath, "rapid-recycle.json"), "utf8")).resolves.toBe(`${JSON.stringify(validProfile, null, 2)}\n`);
  });

  it("returns a persisted ScoringProfile by name", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    await request(app).post("/api/admin/profiles").send(validProfile);
    const response = await request(app).get("/api/admin/profiles/rapid-recycle");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(validProfile);
  });

  it("rejects invalid ScoringProfile JSON with precise field paths", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    const response = await request(app).post("/api/admin/profiles").send({
      name: "",
      version: "",
      alliance_size: 4,
      phases: ["auto", 7],
      fields: [
        {
          key: "",
          label: "",
          type: "counter",
          points_per_unit: "two"
        },
        {
          key: "choice",
          label: "Choice",
          type: "enum",
          points_per_option: {
            yes: "four"
          }
        },
        {
          key: "unsupported",
          label: "Unsupported",
          type: "unsupported"
        }
      ]
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name" }),
      expect.objectContaining({ path: "version" }),
      expect.objectContaining({ path: "alliance_size" }),
      expect.objectContaining({ path: "phases[1]" }),
      expect.objectContaining({ path: "fields[0].key" }),
      expect.objectContaining({ path: "fields[0].label" }),
      expect.objectContaining({ path: "fields[0].points_per_unit" }),
      expect.objectContaining({ path: "fields[1].points_per_option.yes" }),
      expect.objectContaining({ path: "fields[2].type" })
    ]));
  });

  it("rejects unsafe profile names", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    const response = await request(app).post("/api/admin/profiles").send({
      ...validProfile,
      name: "../escape"
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name" })
    ]));
  });
});
