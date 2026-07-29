import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { startMongoFixture } from "../../test/mongo-fixture";

const profile = {
  name: "groups", version: "1", alliance_size: 3, phases: [],
  fields: [{ key: "count", label: "Count", type: "counter", points_per_unit: 2 }]
};

describe("admin ScoutRecord groups", () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

  it("lists groups and returns side-by-side detail with aggregation", async () => {
    const profileStoragePath = await mkdtemp(path.join(tmpdir(), "miniscout-groups-"));
    const mongo = await startMongoFixture(`groups-${Math.random().toString(36).slice(2)}`);
    cleanups.push(async () => { await mongo.close(); await rm(profileStoragePath, { recursive: true, force: true }); });
    const app = createApp({ profileStoragePath, mongoDatabase: mongo.database });
    await request(app).post("/api/admin/profiles").send(profile);
    const mint = await request(app).post("/api/admin/competitions").send({ name: "Event", scoring_profile_name: profile.name, lan_base_url: "http://x" });
    const competition = mint.body.competition;
    await mongo.database.collections.records.insertMany([
      { _id: "r1", competition_id: competition._id, match_number: "1", team_number: "2", scouter_name: "Alice", scouter_cookie_id: "a", values: { count: 2 }, submitted_at: new Date() },
      { _id: "r2", competition_id: competition._id, match_number: "1", team_number: "2", scouter_name: "Bob", scouter_cookie_id: "b", values: { count: 6 }, submitted_at: new Date() }
    ]);

    const list = await request(app).get(`/api/admin/competitions/${competition._id}/records`);
    expect(list.body.groups).toEqual([expect.objectContaining({ match_number: "1", team_number: "2", record_count: 2, multi_scouted: true, aggregated_total: 8 })]);

    const detail = await request(app).get(`/api/admin/competitions/${competition._id}/groups/1/2`);
    expect(detail.body.group).toMatchObject({ record_count: 2, multi_scouted: true, aggregated: { total: 8 } });
    expect(detail.body.group.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ scouter_name: "Alice", values: { count: 2 }, estimated_score: { total: 4, by_phase: {}, by_target: {} } }),
      expect.objectContaining({ scouter_name: "Bob", values: { count: 6 }, estimated_score: { total: 12, by_phase: {}, by_target: {} } })
    ]));
  });
});
