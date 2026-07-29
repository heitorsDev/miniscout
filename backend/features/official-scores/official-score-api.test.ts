import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { startMongoFixture, type MongoFixture } from "../../test/mongo-fixture";

const validProfile = {
  name: "rapid-recycle",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    { key: "pieces_scored", label: "Pieces scored", type: "counter", phase: "teleop", points_per_unit: 2 }
  ]
};

type Ctx = {
  app: Awaited<ReturnType<typeof createApp>>;
  cleanup: () => Promise<void>;
};

describe("admin OfficialScore API", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const mongoInstances: MongoFixture[] = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn()));
    await Promise.all(mongoInstances.splice(0).map((mongo) => mongo.close()));
  });

  async function setup(): Promise<Ctx> {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-offscore-"));
    cleanups.push(() => rm(profileStoragePath, { recursive: true, force: true }));
    const mongo = await startMongoFixture(`offscore-api-${Math.random().toString(36).slice(2, 10)}`);
    mongoInstances.push(mongo);
    const app = createApp({ profileStoragePath, mongoDatabase: mongo.database });
    await request(app).post("/api/admin/profiles").send(validProfile);
    return {
      app,
      cleanup: async () => {
        await rm(profileStoragePath, { recursive: true, force: true });
        await mongo.close();
      }
    };
  }

  async function mintCompetition(app: Awaited<ReturnType<typeof createApp>>): Promise<string> {
    const response = await request(app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });
    expect(response.status).toBe(200);
    return response.body.competition._id as string;
  }

  it("upserts an OfficialScore for a match_number via PUT and reads it back via GET", async () => {
    const { app } = await setup();
    const competitionId = await mintCompetition(app);

    const put = await request(app)
      .put(`/api/admin/competitions/${competitionId}/official-scores`)
      .send({ match_number: "12", red_score: 110, blue_score: 95 });

    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({
      competition_id: competitionId,
      match_number: "12",
      red_score: 110,
      blue_score: 95
    });
    expect(put.body._id).toMatch(/^off_/);

    const list = await request(app)
      .get(`/api/admin/competitions/${competitionId}/official-scores`);
    expect(list.status).toBe(200);
    expect(list.body.official_scores).toEqual([
      expect.objectContaining({ match_number: "12", red_score: 110, blue_score: 95 })
    ]);
  });

  it("replaces an existing OfficialScore when PUT is called again for the same match", async () => {
    const { app } = await setup();
    const competitionId = await mintCompetition(app);

    await request(app)
      .put(`/api/admin/competitions/${competitionId}/official-scores`)
      .send({ match_number: "Q1", red_score: 10, blue_score: 20 });
    const second = await request(app)
      .put(`/api/admin/competitions/${competitionId}/official-scores`)
      .send({ match_number: "Q1", red_score: 30, blue_score: 40 });

    expect(second.status).toBe(200);
    const list = await request(app).get(`/api/admin/competitions/${competitionId}/official-scores`);
    expect(list.body.official_scores).toHaveLength(1);
    expect(list.body.official_scores[0]).toMatchObject({ red_score: 30, blue_score: 40 });
  });

  it("rejects a PUT when match_number is missing", async () => {
    const { app } = await setup();
    const competitionId = await mintCompetition(app);

    const response = await request(app)
      .put(`/api/admin/competitions/${competitionId}/official-scores`)
      .send({ red_score: 1, blue_score: 2 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request");
  });

  it("rejects a PUT when scores are not integers", async () => {
    const { app } = await setup();
    const competitionId = await mintCompetition(app);

    const response = await request(app)
      .put(`/api/admin/competitions/${competitionId}/official-scores`)
      .send({ match_number: "Q3", red_score: 1.5, blue_score: 2 });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the competition does not exist", async () => {
    const { app } = await setup();

    const response = await request(app)
      .put(`/api/admin/competitions/cmp_missing/official-scores`)
      .send({ match_number: "Q1", red_score: 1, blue_score: 2 });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: expect.stringMatching(/competition/i) });
  });
});