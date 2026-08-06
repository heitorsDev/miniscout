/// <reference types="vitest" />
import { afterEach, describe, expect, it } from "vitest";
import {
  applyStyleProfile,
  mapDarkStyleProfileToCssVariables,
  mapStyleProfileToCssVariables
} from "../lib/applyStyleProfile";
import type { StyleProfile } from "../lib/types";

const baseProfile: StyleProfile = {
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

describe("mapStyleProfileToCssVariables", () => {
  it("maps every color field to its CSS custom property", () => {
    const variables = mapStyleProfileToCssVariables(baseProfile);
    expect(variables["--color-bg"]).toBe("#14161a");
    expect(variables["--color-surface"]).toBe("#1c1f26");
    expect(variables["--color-text"]).toBe("#f5f5f2");
    expect(variables["--color-text-muted"]).toBe("#9a9fa8");
    expect(variables["--color-accent"]).toBe("#ff6a00");
    expect(variables["--color-accent-contrast"]).toBe("#14161a");
    expect(variables["--color-border"]).toBe("#2a2e37");
    expect(variables["--color-danger"]).toBe("#e5484d");
    expect(variables["--color-success"]).toBe("#2fae60");
  });

  it("maps typography enums to font stacks", () => {
    const variables = mapStyleProfileToCssVariables(baseProfile);
    expect(variables["--font-ui"]).toContain("Inter");
    expect(variables["--font-mono"]).toContain("JetBrains Mono");
  });

  it("maps shape.radius=sharp to the sharp-corner radius preset", () => {
    const variables = mapStyleProfileToCssVariables(baseProfile);
    expect(variables["--radius-sm"]).toBe("2px");
    expect(variables["--radius-md"]).toBe("3px");
    expect(variables["--radius-lg"]).toBe("4px");
  });

  it("maps shape.radius=rounded to a larger radius preset", () => {
    const rounded: StyleProfile = { ...baseProfile, shape: { ...baseProfile.shape, radius: "rounded" } };
    const variables = mapStyleProfileToCssVariables(rounded);
    expect(variables["--radius-sm"]).toBe("8px");
    expect(variables["--radius-md"]).toBe("12px");
    expect(variables["--radius-lg"]).toBe("18px");
  });

  it("maps shape.density=compact to the tighter spacing scale", () => {
    const variables = mapStyleProfileToCssVariables(baseProfile);
    expect(variables["--space-1"]).toBe("4px");
    expect(variables["--space-6"]).toBe("32px");
  });

  it("maps shape.density=spacious to a looser spacing scale", () => {
    const spacious: StyleProfile = { ...baseProfile, shape: { ...baseProfile.shape, density: "spacious" } };
    const variables = mapStyleProfileToCssVariables(spacious);
    expect(variables["--space-1"]).toBe("6px");
    expect(variables["--space-6"]).toBe("48px");
  });

  it("omits colors.dark from the base variable map", () => {
    const withDark: StyleProfile = {
      ...baseProfile,
      colors: { ...baseProfile.colors, dark: { background: "#000000" } }
    };
    const variables = mapStyleProfileToCssVariables(withDark);
    expect(variables["--color-bg"]).toBe("#14161a");
  });
});

describe("mapDarkStyleProfileToCssVariables", () => {
  it("returns null when colors.dark is absent", () => {
    expect(mapDarkStyleProfileToCssVariables(baseProfile)).toBeNull();
  });

  it("maps only the overridden dark color fields, given a partial dark variant", () => {
    const withPartialDark: StyleProfile = {
      ...baseProfile,
      colors: { ...baseProfile.colors, dark: { background: "#000000", accent: "#ff8800" } }
    };
    const variables = mapDarkStyleProfileToCssVariables(withPartialDark);
    expect(variables).toEqual({
      "--color-bg": "#000000",
      "--color-accent": "#ff8800"
    });
  });

  it("returns null when colors.dark is present but empty", () => {
    const withEmptyDark: StyleProfile = {
      ...baseProfile,
      colors: { ...baseProfile.colors, dark: {} }
    };
    expect(mapDarkStyleProfileToCssVariables(withEmptyDark)).toBeNull();
  });
});

describe("applyStyleProfile", () => {
  afterEach(() => {
    document.getElementById("style-profile-dark-overrides")?.remove();
    document.documentElement.removeAttribute("style");
  });

  it("writes base CSS variables onto the given root element", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    applyStyleProfile(baseProfile, root);
    expect(root.style.getPropertyValue("--color-accent")).toBe("#ff6a00");
    root.remove();
  });

  it("writes to document.documentElement by default", () => {
    applyStyleProfile(baseProfile);
    expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe("#14161a");
  });

  it("creates a prefers-color-scheme: dark stylesheet when colors.dark is present", () => {
    const withDark: StyleProfile = {
      ...baseProfile,
      colors: { ...baseProfile.colors, dark: { background: "#050505" } }
    };
    applyStyleProfile(withDark);
    const styleElement = document.getElementById("style-profile-dark-overrides");
    expect(styleElement).not.toBeNull();
    expect(styleElement?.textContent).toContain("prefers-color-scheme: dark");
    expect(styleElement?.textContent).toContain("--color-bg: #050505;");
  });

  it("removes the dark stylesheet when a profile without colors.dark is applied", () => {
    const withDark: StyleProfile = {
      ...baseProfile,
      colors: { ...baseProfile.colors, dark: { background: "#050505" } }
    };
    applyStyleProfile(withDark);
    expect(document.getElementById("style-profile-dark-overrides")).not.toBeNull();

    applyStyleProfile(baseProfile);
    expect(document.getElementById("style-profile-dark-overrides")).toBeNull();
  });
});
