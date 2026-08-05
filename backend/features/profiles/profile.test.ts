import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";

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

  it("reports API health for readiness probes", async () => {
    const response = await request(createApp()).get("/api/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("accepts valid ScoringProfile JSON and persists it at configured path", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    const response = await request(app).post("/api/admin/profiles").send(validProfile);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(validProfile);
    const savedProfile = await readFile(path.join(profileStoragePath, "rapid-recycle.json"), "utf8");
    expect(JSON.parse(savedProfile)).toEqual(validProfile);
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
        },
        {
          key: "missing-boolean-points",
          label: "Missing boolean points",
          type: "boolean"
        },
        {
          key: "invalid-number-points",
          label: "Invalid number points",
          type: "number",
          points_per_unit: "one"
        },
        {
          key: "note-with-points",
          label: "Note with points",
          type: "note",
          points_per_unit: 1
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
      expect.objectContaining({ path: "fields[2].type" }),
      expect.objectContaining({ path: "fields[3].points_per_unit" }),
      expect.objectContaining({ path: "fields[4].points_per_unit" }),
      expect.objectContaining({ path: "fields[5]" })
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

  it("lists no profiles when the storage directory has none persisted yet", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    const response = await request(app).get("/api/admin/profiles");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ profiles: [] });
  });

  it("lists persisted profile names sorted alphabetically", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    await request(app).post("/api/admin/profiles").send(validProfile);
    await request(app).post("/api/admin/profiles").send({ ...validProfile, name: "alpha-scheme" });

    const response = await request(app).get("/api/admin/profiles");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ profiles: ["alpha-scheme", "rapid-recycle"] });
  });

  it("excludes dotfiles and temp files left behind by concurrent save() calls", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
    temporaryDirectories.push(profileStoragePath);
    const app = createApp({ profileStoragePath });

    await request(app).post("/api/admin/profiles").send(validProfile);
    await writeFile(
      path.join(profileStoragePath, `.${validProfile.name}.leftover-temp.tmp`),
      "{}",
      "utf8"
    );
    await writeFile(path.join(profileStoragePath, ".hidden-profile.json"), "{}", "utf8");

    const filesOnDisk = await readdir(profileStoragePath);
    expect(filesOnDisk.length).toBeGreaterThan(1);

    const response = await request(app).get("/api/admin/profiles");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ profiles: ["rapid-recycle"] });
  });
});
