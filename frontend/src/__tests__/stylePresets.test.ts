import { describe, expect, it } from "vitest";
import { validateStyleProfile } from "../../../backend/features/style-profile/style-profile.schema";
import { stylePresets } from "../lib/stylePresets";

describe("stylePresets", () => {
  it("bundles exactly six presets", () => {
    expect(stylePresets).toHaveLength(6);
  });

  it("has a unique id and non-empty label for every preset", () => {
    const ids = stylePresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of stylePresets) {
      expect(preset.label.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(stylePresets.map((preset) => [preset.id, preset] as const))(
    "preset %s validates against the real StyleProfile zod schema",
    (_id, preset) => {
      const result = validateStyleProfile(preset.profile);
      if (!result.success) {
        throw new Error(
          `Preset "${preset.id}" failed schema validation: ${JSON.stringify(result.errors, null, 2)}`
        );
      }
      expect(result.success).toBe(true);
    }
  );

  it("includes the Pit-Crew Industrial preset matching the bundled backend default exactly", async () => {
    const { defaultStyleProfile } = await import(
      "../../../backend/features/style-profile/style-profile.defaults"
    );
    const preset = stylePresets.find((candidate) => candidate.id === "pit-crew-industrial");
    expect(preset).toBeDefined();
    expect(preset?.profile).toEqual(defaultStyleProfile);
  });

  it("includes the Unimate preset with a black background and a purple accent", () => {
    const preset = stylePresets.find((candidate) => candidate.id === "unimate");
    expect(preset).toBeDefined();
    expect(preset?.profile.colors.background.toLowerCase()).toBe("#000000");
    expect(preset?.profile.colors.accent.toLowerCase()).toMatch(/^#[89a-c][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]$/);
  });
});
