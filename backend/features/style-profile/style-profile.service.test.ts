import { describe, expect, it } from "vitest";
import { mergeWithDefaultStyleProfile, loadActiveStyleProfile } from "./style-profile.service";
import { defaultStyleProfile } from "./style-profile.defaults";
import { StyleProfileNotFoundError } from "./style-profile.repository";
import type { StyleProfileRepository } from "./style-profile.repository";

function createFakeRepository(overrides: Partial<StyleProfileRepository> = {}): StyleProfileRepository {
  return {
    exists: async () => false,
    load: async () => {
      throw new StyleProfileNotFoundError();
    },
    loadRaw: async () => {
      throw new StyleProfileNotFoundError();
    },
    save: async () => undefined,
    ...overrides
  };
}

describe("mergeWithDefaultStyleProfile", () => {
  it("returns the bundled default untouched when input is undefined", () => {
    expect(mergeWithDefaultStyleProfile(undefined)).toEqual(defaultStyleProfile);
  });

  it("returns the bundled default untouched when input is not an object", () => {
    expect(mergeWithDefaultStyleProfile("not-an-object")).toEqual(defaultStyleProfile);
  });

  it("fills missing top-level sections with defaults while keeping provided ones", () => {
    const merged = mergeWithDefaultStyleProfile({
      name: "Custom",
      colors: { ...defaultStyleProfile.colors, accent: "#00ffaa" }
    });

    expect(merged.name).toBe("Custom");
    expect(merged.colors.accent).toBe("#00ffaa");
    expect(merged.colors.background).toBe(defaultStyleProfile.colors.background);
    expect(merged.typography).toEqual(defaultStyleProfile.typography);
    expect(merged.logo).toEqual(defaultStyleProfile.logo);
    expect(merged.shape).toEqual(defaultStyleProfile.shape);
  });

  it("fills missing individual color fields from defaults", () => {
    const merged = mergeWithDefaultStyleProfile({
      colors: { accent: "#00ffaa" }
    });

    expect(merged.colors.accent).toBe("#00ffaa");
    expect(merged.colors.background).toBe(defaultStyleProfile.colors.background);
    expect(merged.colors.surface).toBe(defaultStyleProfile.colors.surface);
  });

  it("merges a partial dark variant field-by-field against defaults' dark (or an empty object)", () => {
    const merged = mergeWithDefaultStyleProfile({
      colors: { ...defaultStyleProfile.colors, dark: { background: "#000000" } }
    });

    expect(merged.colors.dark).toEqual({ background: "#000000" });
  });

  it("omits dark entirely when neither input nor defaults provide it", () => {
    const merged = mergeWithDefaultStyleProfile({ colors: { ...defaultStyleProfile.colors } });

    expect(merged.colors.dark).toBeUndefined();
  });
});

describe("loadActiveStyleProfile", () => {
  it("returns the bundled default when no file has been saved yet", async () => {
    const repository = createFakeRepository();

    const profile = await loadActiveStyleProfile(repository);

    expect(profile).toEqual(defaultStyleProfile);
  });

  it("returns the merged, validated profile when a partial file exists", async () => {
    const repository = createFakeRepository({
      load: async () => ({ name: "Saved", colors: { accent: "#123456" } })
    });

    const profile = await loadActiveStyleProfile(repository);

    expect(profile.name).toBe("Saved");
    expect(profile.colors.accent).toBe("#123456");
    expect(profile.colors.background).toBe(defaultStyleProfile.colors.background);
  });

  it("propagates unexpected repository errors", async () => {
    const repository = createFakeRepository({
      load: async () => {
        throw new Error("disk on fire");
      }
    });

    await expect(loadActiveStyleProfile(repository)).rejects.toThrow("disk on fire");
  });
});
