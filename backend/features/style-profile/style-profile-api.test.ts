import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createFileStyleProfileRepository } from "./style-profile.repository";
import { createStyleProfileController } from "./style-profile.controller";
import { createStyleProfileRoutes } from "./style-profile.routes";
import { defaultStyleProfile } from "./style-profile.defaults";

function createTestApp(storagePath: string): express.Express {
  const app = express();
  app.use(express.json());
  const repository = createFileStyleProfileRepository(storagePath);
  const controller = createStyleProfileController(repository);
  app.use("/api", createStyleProfileRoutes(controller));
  return app;
}

const customProfile = {
  name: "Custom Theme",
  colors: {
    background: "#000000",
    surface: "#111111",
    text: "#ffffff",
    textMuted: "#aaaaaa",
    accent: "#00ffaa",
    accentContrast: "#000000",
    border: "#222222",
    danger: "#ff0000",
    success: "#00ff00",
    dark: {
      background: "#010101"
    }
  },
  typography: {
    fontUi: "inter",
    fontMono: "jetbrains-mono"
  },
  logo: {
    dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    teamName: "Team 9999"
  },
  shape: {
    radius: "rounded",
    density: "spacious"
  }
};

describe("StyleProfile API", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  async function createTempStoragePath(): Promise<string> {
    const storagePath = await mkdtemp(path.join(tmpdir(), "miniscout-style-profile-"));
    temporaryDirectories.push(storagePath);
    return storagePath;
  }

  it("GET returns the bundled default when no file has been saved yet", async () => {
    const storagePath = await createTempStoragePath();
    const app = createTestApp(storagePath);

    const response = await request(app).get("/api/style-profile");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(defaultStyleProfile);
  });

  it("PUT persists a valid profile and GET returns exactly what was saved", async () => {
    const storagePath = await createTempStoragePath();
    const app = createTestApp(storagePath);

    const putResponse = await request(app).put("/api/admin/style-profile").send(customProfile);
    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toEqual(customProfile);

    const getResponse = await request(app).get("/api/style-profile");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(customProfile);
  });

  it("PUT replaces the previous profile wholesale rather than merging", async () => {
    const storagePath = await createTempStoragePath();
    const app = createTestApp(storagePath);

    await request(app).put("/api/admin/style-profile").send(customProfile);

    const replacement = {
      ...defaultStyleProfile,
      name: "Second Theme"
    };
    const putResponse = await request(app).put("/api/admin/style-profile").send(replacement);
    expect(putResponse.status).toBe(200);

    const getResponse = await request(app).get("/api/style-profile");
    expect(getResponse.body).toEqual(replacement);
    // the previous profile's dark variant and custom logo must be gone, not merged in
    expect(getResponse.body.colors.dark).toBeUndefined();
    expect(getResponse.body.logo).toEqual(defaultStyleProfile.logo);
  });

  it("PUT rejects an invalid profile with 400 and does not persist it", async () => {
    const storagePath = await createTempStoragePath();
    const app = createTestApp(storagePath);

    const response = await request(app).put("/api/admin/style-profile").send({
      ...customProfile,
      colors: { ...customProfile.colors, accent: "not-a-color" }
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "colors.accent" })
    ]));

    const getResponse = await request(app).get("/api/style-profile");
    expect(getResponse.body).toEqual(defaultStyleProfile);
  });

  it("PUT rejects a partial payload rather than treating it as a patch", async () => {
    const storagePath = await createTempStoragePath();
    const app = createTestApp(storagePath);

    const response = await request(app).put("/api/admin/style-profile").send({
      name: "Just a name"
    });

    expect(response.status).toBe(400);
  });
});
