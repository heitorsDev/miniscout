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
  mongo: MongoFixture;
  cleanup: () => Promise<void>;
};

describe("admin ScoutRecord DELETE endpoint", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn()));
  });

  async function setup(): Promise<Ctx> {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-record-delete-"));
    cleanups.push(() => rm(profileStoragePath, { recursive: true, force: true }));
    const mongo = await startMongoFixture(`record-delete-${Math.random().toString(36).slice(2, 10)}`);
    const app = createApp({ profileStoragePath, mongoDatabase: mongo.database });
    await request(app).post("/api/admin/profiles").send(validProfile);
    return {
      app,
      mongo,
      cleanup: async () => {
        await rm(profileStoragePath, { recursive: true, force: true });
        await mongo.close();
      }
    };
  }

  async function submitRecord(app: Awaited<ReturnType<typeof createApp>>, qrToken: string, scouterName: string, body: { match_number: string; team_number: string; values: Record<string, unknown> }) {
    const register = await request(app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: scouterName });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];
    const response = await request(app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookie ?? "")
      .send({ scouter_name: scouterName, ...body });
    expect(response.status).toBe(201);
    return response.body.record_id as string;
  }

  it("removes a single ScoutRecord so it disappears from the admin list and CSV", async () => {
    const { app, mongo, cleanup } = await setup();
    cleanups.push(cleanup);

    const mint = await request(app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });
    const competitionId = mint.body.competition._id as string;
    const qrToken = mint.body.competition.qr_token as string;

    const keepId = await submitRecord(app, qrToken, "Alice", { match_number: "Q1", team_number: "12", values: { pieces_scored: 4 } });
    const typoId = await submitRecord(app, qrToken, "Bob", { match_number: "Q1", team_number: "12", values: { pieces_scored: 1 } });

    expect(keepId).not.toBe(typoId);

    const deleteResponse = await request(app).delete(`/api/admin/records/${typoId}`);
    expect(deleteResponse.status).toBe(204);

    const remaining = await mongo.database.collections.records.find({}).toArray();
    expect(remaining.map((doc) => doc._id)).toEqual([keepId]);

    const listResponse = await request(app).get(`/api/admin/competitions/${competitionId}/records`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.groups).toHaveLength(1);
    expect(listResponse.body.groups[0]).toMatchObject({
      match_number: "Q1",
      team_number: "12",
      record_count: 1,
      multi_scouted: false
    });
  });

  it("returns 404 when the record id does not exist", async () => {
    const { app, cleanup } = await setup();
    cleanups.push(cleanup);

    const response = await request(app).delete("/api/admin/records/rec_does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: expect.stringMatching(/record/i) });
  });

  it("rejects deletion of a stray record so the (match, team) group reverts to a single-record group", async () => {
    const { app, mongo, cleanup } = await setup();
    cleanups.push(cleanup);

    const mint = await request(app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });
    const qrToken = mint.body.competition.qr_token as string;

    const firstId = await submitRecord(app, qrToken, "Alice", { match_number: "Q9", team_number: "100", values: { pieces_scored: 8 } });
    const secondId = await submitRecord(app, qrToken, "Eve", { match_number: "Q9", team_number: "100", values: { pieces_scored: 2 } });

    expect(await mongo.database.collections.records.countDocuments({ match_number: "Q9", team_number: "100" })).toBe(2);

    await request(app).delete(`/api/admin/records/${secondId}`).expect(204);

    expect(await mongo.database.collections.records.countDocuments({ match_number: "Q9", team_number: "100" })).toBe(1);
    const remaining = await mongo.database.collections.records.findOne({ _id: firstId });
    expect(remaining).toBeTruthy();
  });
});