import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteOfficialScoreForMatch,
  listOfficialScoresForCompetition,
  newOfficialScoreId,
  upsertOfficialScore,
  type OfficialScoreView
} from "./official-scores";
import { startMongoFixture, type MongoFixture } from "./test/mongo-fixture";

describe("official-scores repository", () => {
  let mongo: MongoFixture;
  let cleanup: Array<() => Promise<void>>;

  beforeEach(async () => {
    mongo = await startMongoFixture(`offscore-${Math.random().toString(36).slice(2, 10)}`);
    cleanup = [mongo.close];
  });

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((fn) => fn()));
  });

  it("upserts an OfficialScore for a match and exposes it via the competition listing", async () => {
    const competitionId = "cmp_test";
    const created = await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "12",
      red_score: 110,
      blue_score: 95
    });

    expect(created.competition_id).toBe(competitionId);
    expect(created.match_number).toBe("12");
    expect(created.red_score).toBe(110);
    expect(created.blue_score).toBe(95);
    expect(created._id.startsWith("off_")).toBe(true);

    const all = await listOfficialScoresForCompetition(mongo.database, competitionId);
    expect(all).toEqual<OfficialScoreView[]>([
      {
        _id: created._id,
        competition_id: competitionId,
        match_number: "12",
        red_score: 110,
        blue_score: 95,
        updated_at: created.updated_at
      }
    ]);
  });

  it("upserts replace an existing OfficialScore for the same (competition, match)", async () => {
    const competitionId = "cmp_test";
    const first = await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q1",
      red_score: 30,
      blue_score: 40
    });
    const second = await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q1",
      red_score: 99,
      blue_score: 0
    });

    expect(second._id).toBe(first._id);
    expect(second.red_score).toBe(99);

    const all = await listOfficialScoresForCompetition(mongo.database, competitionId);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ red_score: 99, blue_score: 0 });
  });

  it("lists OfficialScores sorted by match_number then updated_at", async () => {
    const competitionId = "cmp_test";
    await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q3",
      red_score: 10,
      blue_score: 20
    });
    await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q1",
      red_score: 30,
      blue_score: 40
    });
    await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q2",
      red_score: 50,
      blue_score: 60
    });

    const all = await listOfficialScoresForCompetition(mongo.database, competitionId);
    expect(all.map((row) => row.match_number)).toEqual(["Q1", "Q2", "Q3"]);
  });

  it("isolates OfficialScores by competition_id", async () => {
    await upsertOfficialScore(mongo.database, {
      competition_id: "cmp_a",
      match_number: "Q1",
      red_score: 1,
      blue_score: 2
    });
    await upsertOfficialScore(mongo.database, {
      competition_id: "cmp_b",
      match_number: "Q1",
      red_score: 3,
      blue_score: 4
    });

    const a = await listOfficialScoresForCompetition(mongo.database, "cmp_a");
    const b = await listOfficialScoresForCompetition(mongo.database, "cmp_b");

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].red_score).toBe(1);
    expect(b[0].red_score).toBe(3);
  });

  it("deletes the OfficialScore for a match and reports whether one was removed", async () => {
    const competitionId = "cmp_test";
    await upsertOfficialScore(mongo.database, {
      competition_id: competitionId,
      match_number: "Q5",
      red_score: 7,
      blue_score: 11
    });

    const removed = await deleteOfficialScoreForMatch(mongo.database, competitionId, "Q5");
    expect(removed).toBe(true);

    const all = await listOfficialScoresForCompetition(mongo.database, competitionId);
    expect(all).toHaveLength(0);

    const removedAgain = await deleteOfficialScoreForMatch(mongo.database, competitionId, "Q5");
    expect(removedAgain).toBe(false);
  });

  it("exports an OfficialScore id factory in the expected format", () => {
    const id = newOfficialScoreId();
    expect(id).toMatch(/^off_[0-9a-f-]{36}$/);
  });
});