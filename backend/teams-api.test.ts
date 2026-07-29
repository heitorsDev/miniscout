import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { startMongoFixture, type MongoFixture } from "./test/mongo-fixture";

const profile = {
  name: "rapid-recycle",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    { key: "pieces_scored", label: "Pieces scored", type: "counter", phase: "teleop", points_per_unit: 2 }
  ]
};

describe("admin teams rollup endpoint", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const mongoInstances: MongoFixture[] = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn()));
    await Promise.all(mongoInstances.splice(0).map((mongo) => mongo.close()));
  });

  async function setup(): Promise<{
    app: Awaited<ReturnType<typeof createApp>>;
    competitionId: string;
    qrToken: string;
    cleanup: () => Promise<void>;
  }> {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-teams-"));
    cleanups.push(() => rm(profileStoragePath, { recursive: true, force: true }));
    const mongo = await startMongoFixture(`teams-${Math.random().toString(36).slice(2, 10)}`);
    mongoInstances.push(mongo);
    const app = createApp({ profileStoragePath, mongoDatabase: mongo.database });
    await request(app).post("/api/admin/profiles").send(profile);
    const mint = await request(app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: profile.name, lan_base_url: "http://h/scout" });
    return {
      app,
      competitionId: mint.body.competition._id as string,
      qrToken: mint.body.competition.qr_token as string,
      cleanup: async () => {
        await rm(profileStoragePath, { recursive: true, force: true });
        await mongo.close();
      }
    };
  }

  async function submit(app: Awaited<ReturnType<typeof createApp>>, qrToken: string, scouterName: string, body: { match_number: string; team_number: string; values: Record<string, unknown> }) {
    const register = await request(app).post(`/api/competitions/${qrToken}/scouter`).send({ name: scouterName });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];
    const response = await request(app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookie ?? "")
      .send({ scouter_name: scouterName, ...body });
    expect(response.status).toBe(201);
  }

  it("returns an empty teams list when no records exist", async () => {
    const { app, competitionId, cleanup } = await setup();
    cleanups.push(cleanup);

    const response = await request(app).get(`/api/admin/competitions/${competitionId}/teams`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ teams: [] });
  });

  it("aggregates per-team rollups across matches with median score per match", async () => {
    const { app, competitionId, qrToken, cleanup } = await setup();
    cleanups.push(cleanup);

    await submit(app, qrToken, "Alice", { match_number: "Q1", team_number: "12", values: { pieces_scored: 5 } });
    await submit(app, qrToken, "Bob", { match_number: "Q1", team_number: "12", values: { pieces_scored: 7 } });
    await submit(app, qrToken, "Carol", { match_number: "Q2", team_number: "12", values: { pieces_scored: 4 } });
    await submit(app, qrToken, "Dan", { match_number: "Q1", team_number: "99", values: { pieces_scored: 1 } });

    const response = await request(app).get(`/api/admin/competitions/${competitionId}/teams`);

    expect(response.status).toBe(200);
    const teams = response.body.teams;
    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      team_number: "12",
      record_count: 3,
      matches_scouted: ["Q1", "Q2"]
    });
    expect(teams[0].matches).toEqual([
      { match_number: "Q1", record_count: 2, median_estimated_score: 12 },
      { match_number: "Q2", record_count: 1, median_estimated_score: 8 }
    ]);
    expect(teams[1]).toMatchObject({
      team_number: "99",
      record_count: 1,
      matches_scouted: ["Q1"]
    });
    expect(teams[1].matches).toEqual([
      { match_number: "Q1", record_count: 1, median_estimated_score: 2 }
    ]);
  });

  it("returns 404 when the competition is missing", async () => {
    const { app, cleanup } = await setup();
    cleanups.push(cleanup);

    const response = await request(app).get("/api/admin/competitions/cmp_missing/teams");
    expect(response.status).toBe(404);
  });
});