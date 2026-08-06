import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFileStyleProfileRepository,
  StyleProfileNotFoundError,
  styleProfileFilePath
} from "./style-profile.repository";
import { defaultStyleProfile } from "./style-profile.defaults";

describe("file StyleProfile repository", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  async function createTempStoragePath(): Promise<string> {
    const storagePath = await mkdtemp(path.join(tmpdir(), "miniscout-style-profile-"));
    temporaryDirectories.push(storagePath);
    return storagePath;
  }

  it("reports the profile as absent before anything has been saved", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileStyleProfileRepository(storagePath);

    expect(await repository.exists()).toBe(false);
  });

  it("throws StyleProfileNotFoundError when loading before a save", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileStyleProfileRepository(storagePath);

    await expect(repository.load()).rejects.toBeInstanceOf(StyleProfileNotFoundError);
    await expect(repository.loadRaw()).rejects.toBeInstanceOf(StyleProfileNotFoundError);
  });

  it("saves the profile to the fixed style-profile.json path and loads it back", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileStyleProfileRepository(storagePath);

    await repository.save(defaultStyleProfile);

    expect(await repository.exists()).toBe(true);
    expect(await repository.load()).toEqual(defaultStyleProfile);
    const onDisk = await readFile(styleProfileFilePath(storagePath), "utf8");
    expect(JSON.parse(onDisk)).toEqual(defaultStyleProfile);
  });

  it("wholesale replaces the previously saved profile rather than merging", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileStyleProfileRepository(storagePath);

    await repository.save(defaultStyleProfile);
    const replacement = {
      ...defaultStyleProfile,
      name: "Custom Theme",
      colors: { ...defaultStyleProfile.colors, accent: "#00ffaa" }
    };
    await repository.save(replacement);

    expect(await repository.load()).toEqual(replacement);
  });

  it("creates the storage directory on save if it does not exist yet", async () => {
    const baseDirectory = await createTempStoragePath();
    const storagePath = path.join(baseDirectory, "nested", "style-profile-dir");
    const repository = createFileStyleProfileRepository(storagePath);

    await repository.save(defaultStyleProfile);

    expect(await repository.load()).toEqual(defaultStyleProfile);
  });
});
