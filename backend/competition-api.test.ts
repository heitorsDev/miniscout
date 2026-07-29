import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type AppOptions } from "./app";
import { startMongoFixture, type MongoFixture } from "./test/mongo-fixture";

type CreateAppOptions = AppOptions;

const validProfile = {
  name: "rapid-recycle",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    { key: "auto_notes", label: "Autonomous notes", type: "note", phase: "auto" },
    { key: "pieces_scored", label: "Pieces scored", type: "counter", phase: "teleop", points_per_unit: 2 },
    { key: "leave", label: "Left starting area", type: "boolean", phase: "auto", points_per_unit: 3 },
    { key: "cycle_quality", label: "Cycle quality", type: "enum", phase: "teleop", points_per_option: { low: 0, high: 4 } },
    { key: "endgame_time", label: "Endgame time", type: "number", phase: "teleop", points_per_unit: 1.5 }
  ]
};

interface SetupOptions {
  profileName?: string;
  appOptions?: CreateAppOptions;
}

async function setupFixture({ profileName = validProfile.name, appOptions }: SetupOptions = {}) {
  const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-profiles-"));
  const mongo = await startMongoFixture(`t-${Math.random().toString(36).slice(2, 10)}`);
  const app = createApp({ profileStoragePath, mongoDatabase: mongo.database, ...appOptions });
  await request(app).post("/api/admin/profiles").send({ ...validProfile, name: profileName });
  return {
    profileStoragePath,
    mongo,
    app,
    cleanup: async () => {
      await mongo.close();
      await rm(profileStoragePath, { recursive: true, force: true });
    }
  };
}

describe("admin Competitions API", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("mints a Competition with a name and scoring_profile_name, generating an opaque QR token", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);

    const response = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: validProfile.name, lan_base_url: "http://192.168.1.10:8082" });

    expect(response.status).toBe(200);
    expect(response.body.competition).toMatchObject({
      name: "Spring 2026",
      scoring_profile_name: validProfile.name
    });
    const qrToken = response.body.competition.qr_token as string;
    expect(qrToken).toMatch(/^[a-f0-9]{32,}$/);
    expect(response.body.qr_url).toBe(`http://192.168.1.10:8082/scout?c=${qrToken}`);
  });

  it("rejects mint when the named ScoringProfile is missing", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);

    const response = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: "no-such-profile", lan_base_url: "http://192.168.1.10:8082" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: expect.stringMatching(/profile/i) });
  });

  it("lists minted Competitions newest-first", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);

    const first = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name: "First", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });
    const second = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name: "Second", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });

    const response = await request(ctx.app).get("/api/admin/competitions");

    expect(response.status).toBe(200);
    expect(response.body.competitions.map((c: { name: string }) => c.name)).toEqual(["Second", "First"]);
    expect(second.body.competition.qr_token).not.toBe(first.body.competition.qr_token);
  });
});

describe("scouter Competition API", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function mintCompetition(ctx: Awaited<ReturnType<typeof setupFixture>>, name = "Spring 2026") {
    const response = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name, scoring_profile_name: validProfile.name, lan_base_url: "http://192.168.1.10:8082" });
    expect(response.status).toBe(200);
    return response.body as { competition: { _id: string; qr_token: string; scoring_profile_name: string }; qr_url: string };
  }

  it("resolves a Competition + active Profile by QR token", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);
    const minted = await mintCompetition(ctx);

    const response = await request(ctx.app).get(`/api/competitions/${minted.competition.qr_token}`);

    expect(response.status).toBe(200);
    expect(response.body.competition.qr_token).toBe(minted.competition.qr_token);
    expect(response.body.profile).toEqual({ ...validProfile, name: validProfile.name });
  });

  it("returns 404 for an unknown QR token", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);

    const response = await request(ctx.app).get("/api/competitions/not-a-real-token");

    expect(response.status).toBe(404);
  });
});

describe("scouter cookie + draft + record API", () => {
  const cleanups: Array<() => Promise<void>> = [];
  let ctx: Awaited<ReturnType<typeof setupFixture>>;
  let qrToken: string;

  beforeEach(async () => {
    ctx = await setupFixture();
    cleanups.push(ctx.cleanup);
    const minted = await request(ctx.app)
      .post("/api/admin/competitions")
      .send({ name: "Spring 2026", scoring_profile_name: validProfile.name, lan_base_url: "http://h/scout" });
    qrToken = minted.body.competition.qr_token as string;
  });

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("issues HttpOnly scouter_cookie_id cookie on name registration with 7-day TTL", async () => {
    const response = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Alice" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ scouter_name: "Alice" });
    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(",") : String(setCookie ?? "");
    expect(cookieHeader).toMatch(/^scouter_cookie_id=/);
    expect(cookieHeader).toMatch(/HttpOnly/i);
    expect(cookieHeader).toMatch(/Max-Age=604800/);
  });

  it("returns the registered name when called with the scouter cookie", async () => {
    const register = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Alice" });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];

    const response = await request(ctx.app)
      .get(`/api/competitions/${qrToken}/scouter`)
      .set("Cookie", cookie ?? "");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ scouter_name: "Alice" });
  });

  it("stores and restores the unsubmitted draft keyed by scouter cookie", async () => {
    const register = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Bob" });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];

    const putResponse = await request(ctx.app)
      .put(`/api/competitions/${qrToken}/draft`)
      .set("Cookie", cookie ?? "")
      .send({
        scouter_name: "Bob",
        match_number: "12",
        team_number: "42",
        values: { pieces_scored: 5, leave: true, auto_notes: "missed" }
      });

    expect(putResponse.status).toBe(200);

    const getResponse = await request(ctx.app)
      .get(`/api/competitions/${qrToken}/draft`)
      .set("Cookie", cookie ?? "");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.draft).toMatchObject({
      scouter_name: "Bob",
      match_number: "12",
      team_number: "42",
      values: { pieces_scored: 5, leave: true, auto_notes: "missed" }
    });
  });

  it("persists a ScoutRecord and returns 201 with the record id", async () => {
    const register = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Carol" });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];

    const response = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookie ?? "")
      .send({
        scouter_name: "Carol",
        match_number: "5",
        team_number: "17",
        values: { pieces_scored: 8, leave: false, cycle_quality: "high", endgame_time: 2.5 }
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ record_id: expect.any(String) });
  });

  it("permits duplicate ScoutRecords for the same (match_number, team_number)", async () => {
    const registerOne = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Dan" });
    const cookieOne = registerOne.headers["set-cookie"]?.[0]?.split(";")[0];

    const registerTwo = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Eve" });
    const cookieTwo = registerTwo.headers["set-cookie"]?.[0]?.split(";")[0];

    const submitOne = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookieOne ?? "")
      .send({
        scouter_name: "Dan",
        match_number: "9",
        team_number: "1234",
        values: { pieces_scored: 1 }
      });
    const submitTwo = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookieTwo ?? "")
      .send({
        scouter_name: "Eve",
        match_number: "9",
        team_number: "1234",
        values: { pieces_scored: 2 }
      });

    expect(submitOne.status).toBe(201);
    expect(submitTwo.status).toBe(201);
    expect(submitTwo.body.record_id).not.toBe(submitOne.body.record_id);
  });

  it("lists records in the admin records endpoint", async () => {
    const register = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/scouter`)
      .send({ name: "Frank" });
    const cookie = register.headers["set-cookie"]?.[0]?.split(";")[0];

    const submit = await request(ctx.app)
      .post(`/api/competitions/${qrToken}/records`)
      .set("Cookie", cookie ?? "")
      .send({
        scouter_name: "Frank",
        match_number: "3",
        team_number: "9999",
        values: { pieces_scored: 4, cycle_quality: "low" }
      });
    expect(submit.status).toBe(201);

    const competitionId = (await request(ctx.app).get("/api/admin/competitions")).body.competitions[0]._id;
    const listResponse = await request(ctx.app).get(`/api/admin/competitions/${competitionId}/records`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.records).toHaveLength(1);
    expect(listResponse.body.records[0]).toMatchObject({
      match_number: "3",
      team_number: "9999",
      scouter_name: "Frank",
      submitted_at: expect.any(String),
      values: { pieces_scored: 4, cycle_quality: "low" }
    });
  });
});

describe("Profile test fixture", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("Persists ScoringProfile JSON before competition mint", async () => {
    const ctx = await setupFixture();
    cleanups.push(ctx.cleanup);
    const contents = await readFile(path.join(ctx.profileStoragePath, `${validProfile.name}.json`), "utf8");
    expect(JSON.parse(contents)).toEqual(validProfile);
  });
});

export type { MongoFixture };
