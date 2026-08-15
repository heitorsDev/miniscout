import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";

describe("Tunnel URL API", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  async function createTempStoragePath(): Promise<string> {
    const storagePath = await mkdtemp(path.join(tmpdir(), "miniscout-tunnel-"));
    temporaryDirectories.push(storagePath);
    return storagePath;
  }

  it("returns 404 when the tunnel URL file does not exist", async () => {
    const storagePath = await createTempStoragePath();
    const app = createApp({ tunnelUrlFilePath: path.join(storagePath, "url") });

    const response = await request(app).get("/api/admin/tunnel-url");

    expect(response.status).toBe(404);
    expect(response.body.error).toBeTruthy();
  });

  it("returns 404 when the tunnel URL file is blank", async () => {
    const storagePath = await createTempStoragePath();
    const filePath = path.join(storagePath, "url");
    await writeFile(filePath, "  \n", "utf8");
    const app = createApp({ tunnelUrlFilePath: filePath });

    const response = await request(app).get("/api/admin/tunnel-url");

    expect(response.status).toBe(404);
  });

  it("returns the discovered tunnel URL", async () => {
    const storagePath = await createTempStoragePath();
    const filePath = path.join(storagePath, "url");
    await mkdir(storagePath, { recursive: true });
    await writeFile(filePath, "https://random-words.trycloudflare.com\n", "utf8");
    const app = createApp({ tunnelUrlFilePath: filePath });

    const response = await request(app).get("/api/admin/tunnel-url");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: "https://random-words.trycloudflare.com" });
  });
});
