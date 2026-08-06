import { describe, expect, it } from "vitest";
import { validateStyleProfile } from "./style-profile.schema";

const validMinimalProfile = {
  name: "Pit-Crew Industrial",
  colors: {
    background: "#14161a",
    surface: "#1c1f26",
    text: "#f5f5f2",
    textMuted: "#9a9fa8",
    accent: "#ff6a00",
    accentContrast: "#14161a",
    border: "#2a2e37",
    danger: "#e5484d",
    success: "#2fae60"
  },
  typography: {
    fontUi: "inter",
    fontMono: "jetbrains-mono"
  },
  logo: {
    dataUri: null,
    teamName: ""
  },
  shape: {
    radius: "sharp",
    density: "compact"
  }
};

describe("style profile schema", () => {
  it("accepts a valid minimal profile", () => {
    const result = validateStyleProfile(validMinimalProfile);
    expect(result.success).toBe(true);
  });

  it("accepts a valid full profile with a dark variant override", () => {
    const fullProfile = {
      ...validMinimalProfile,
      colors: {
        ...validMinimalProfile.colors,
        dark: {
          background: "#0a0b0d",
          accent: "#ff8c33"
        }
      },
      logo: {
        dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
        teamName: "Team 1234"
      }
    };

    const result = validateStyleProfile(fullProfile);
    expect(result.success).toBe(true);
  });

  it("rejects a profile missing required fields", () => {
    const { colors, ...withoutColors } = validMinimalProfile;
    void colors;

    const result = validateStyleProfile(withoutColors);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "colors" })
      ]));
    }
  });

  it("rejects invalid color values", () => {
    const result = validateStyleProfile({
      ...validMinimalProfile,
      colors: {
        ...validMinimalProfile.colors,
        accent: "not-a-color"
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "colors.accent" })
      ]));
    }
  });

  it("rejects a non-enum font name", () => {
    const result = validateStyleProfile({
      ...validMinimalProfile,
      typography: {
        fontUi: "comic-sans",
        fontMono: "jetbrains-mono"
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "typography.fontUi" })
      ]));
    }
  });

  it("rejects a logo dataUri that is not a base64 image data URI", () => {
    const result = validateStyleProfile({
      ...validMinimalProfile,
      logo: {
        dataUri: "https://example.com/logo.png",
        teamName: "Team 1234"
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "logo.dataUri" })
      ]));
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = validateStyleProfile({
      ...validMinimalProfile,
      unexpected: true
    });

    expect(result.success).toBe(false);
  });
});
