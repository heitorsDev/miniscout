import type { StyleProfile } from "./style-profile.types";

/**
 * Bundled default StyleProfile: the "Pit-Crew Industrial" look.
 *
 * Field names mirror the CSS custom property names introduced alongside
 * this default (`--color-bg` -> colors.background, `--color-accent` ->
 * colors.accent, etc.) so wiring this profile into the frontend later is a
 * direct 1:1 mapping with no translation layer.
 */
export const defaultStyleProfile: StyleProfile = {
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
