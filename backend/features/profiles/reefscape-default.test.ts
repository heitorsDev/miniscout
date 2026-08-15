import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFileProfileRepository } from "./profile.repository";
import { seedDefaultProfileIfEmpty } from "./profile.service";
import { validateScoringProfile } from "./profile.schema";
import { defaultReefscapeProfile } from "./reefscape.default";

describe("REEFSCAPE default profile", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  async function createTempStoragePath(): Promise<string> {
    const storagePath = await mkdtemp(path.join(tmpdir(), "miniscout-reefscape-"));
    temporaryDirectories.push(storagePath);
    return storagePath;
  }

  it("is itself a valid ScoringProfile", () => {
    const result = validateScoringProfile(defaultReefscapeProfile);
    expect(result.success).toBe(true);
  });

  it("seeds the default profile into an empty storage directory", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileProfileRepository(storagePath);

    await seedDefaultProfileIfEmpty(repository);

    const names = await repository.list();
    expect(names).toEqual([defaultReefscapeProfile.name]);
  });

  it("does not overwrite an existing profile", async () => {
    const storagePath = await createTempStoragePath();
    const repository = createFileProfileRepository(storagePath);
    await repository.save({
      name: "custom-profile",
      version: "1.0.0",
      alliance_size: 3,
      phases: ["auto"],
      fields: []
    });

    await seedDefaultProfileIfEmpty(repository);

    const names = await repository.list();
    expect(names).toEqual(["custom-profile"]);
  });
});
