import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("scouter match broadcast API", () => {
  it("reports no current match number before any broadcast", async () => {
    const response = await request(createApp()).get("/api/scouter/competition/default");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ competition_id: "default", current_match_number: null });
  });

  it("accepts a scouter's broadcast of the current match number and persists it", async () => {
    const app = createApp();

    const putResponse = await request(app)
      .put("/api/scouter/competition/default/match-number")
      .send({ value: 7 });

    expect(putResponse.status).toBe(200);
    expect(putResponse.body.competition_id).toBe("default");
    expect(putResponse.body.current_match_number).toBe(7);
    expect(typeof putResponse.body.updated_at).toBe("string");

    const getResponse = await request(app).get("/api/scouter/competition/default");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ competition_id: "default", current_match_number: 7 });
  });

  it("overwrites a previous match number on a subsequent broadcast (last-write-wins)", async () => {
    const app = createApp();

    await request(app).put("/api/scouter/competition/default/match-number").send({ value: 3 });
    const response = await request(app)
      .put("/api/scouter/competition/default/match-number")
      .send({ value: 9 });

    expect(response.status).toBe(200);
    expect(response.body.competition_id).toBe("default");
    expect(response.body.current_match_number).toBe(9);
  });

  it("rejects non-integer values with a 400 and field-scoped error", async () => {
    const response = await request(createApp())
      .put("/api/scouter/competition/default/match-number")
      .send({ value: "seven" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "value" })])
    );
  });

  it("rejects negative or zero match numbers", async () => {
    const app = createApp();

    const negative = await request(app)
      .put("/api/scouter/competition/default/match-number")
      .send({ value: -1 });
    expect(negative.status).toBe(400);

    const zero = await request(app)
      .put("/api/scouter/competition/default/match-number")
      .send({ value: 0 });
    expect(zero.status).toBe(400);
  });
});
