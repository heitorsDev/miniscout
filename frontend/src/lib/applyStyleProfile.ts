import type {
  StyleProfile,
  StyleProfileColorKey,
  StyleProfileFontMono,
  StyleProfileFontUi,
  StyleProfileShapeDensity,
  StyleProfileShapeRadius
} from "./types";

/**
 * Single source of truth for mapping a StyleProfile onto the CSS custom
 * property tokens introduced in frontend/src/styles.css (#23). Both the
 * app-init path (main.tsx) and the admin Settings live-preview path call
 * into this module so the two never diverge.
 */

export type CssVariableMap = Record<string, string>;

const COLOR_VARIABLE_NAMES: Record<StyleProfileColorKey, string> = {
  background: "--color-bg",
  surface: "--color-surface",
  text: "--color-text",
  textMuted: "--color-text-muted",
  accent: "--color-accent",
  accentContrast: "--color-accent-contrast",
  border: "--color-border",
  danger: "--color-danger",
  success: "--color-success"
};

const COLOR_KEYS = Object.keys(COLOR_VARIABLE_NAMES) as StyleProfileColorKey[];

const FONT_UI_STACKS: Record<StyleProfileFontUi, string> = {
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif'
};

const FONT_MONO_STACKS: Record<StyleProfileFontMono, string> = {
  "jetbrains-mono": '"JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace'
};

const RADIUS_PRESETS: Record<StyleProfileShapeRadius, { sm: string; md: string; lg: string }> = {
  sharp: { sm: "2px", md: "3px", lg: "4px" },
  rounded: { sm: "8px", md: "12px", lg: "18px" }
};

const DENSITY_PRESETS: Record<StyleProfileShapeDensity, [string, string, string, string, string, string]> = {
  compact: ["4px", "8px", "12px", "16px", "24px", "32px"],
  spacious: ["6px", "12px", "18px", "24px", "36px", "48px"]
};

/**
 * Maps the "light"/base portion of a StyleProfile to CSS custom property
 * values. Does not include `colors.dark` — see mapDarkStyleProfileToCssVariables.
 */
export function mapStyleProfileToCssVariables(profile: StyleProfile): CssVariableMap {
  const variables: CssVariableMap = {};

  for (const key of COLOR_KEYS) {
    const value = profile.colors[key];
    if (value) {
      variables[COLOR_VARIABLE_NAMES[key]] = value;
    }
  }

  variables["--font-ui"] = FONT_UI_STACKS[profile.typography.fontUi];
  variables["--font-mono"] = FONT_MONO_STACKS[profile.typography.fontMono];

  const radius = RADIUS_PRESETS[profile.shape.radius];
  variables["--radius-sm"] = radius.sm;
  variables["--radius-md"] = radius.md;
  variables["--radius-lg"] = radius.lg;

  const density = DENSITY_PRESETS[profile.shape.density];
  variables["--space-1"] = density[0];
  variables["--space-2"] = density[1];
  variables["--space-3"] = density[2];
  variables["--space-4"] = density[3];
  variables["--space-5"] = density[4];
  variables["--space-6"] = density[5];

  return variables;
}

/**
 * Maps `colors.dark` (if present) to the same CSS custom property names,
 * for use inside an `@media (prefers-color-scheme: dark)` block. Returns
 * null when no dark overrides are configured.
 */
export function mapDarkStyleProfileToCssVariables(profile: StyleProfile): CssVariableMap | null {
  const dark = profile.colors.dark;
  if (!dark) {
    return null;
  }

  const variables: CssVariableMap = {};
  for (const key of COLOR_KEYS) {
    const value = dark[key];
    if (value) {
      variables[COLOR_VARIABLE_NAMES[key]] = value;
    }
  }

  return Object.keys(variables).length > 0 ? variables : null;
}

function applyCssVariables(variables: CssVariableMap, target: HTMLElement): void {
  for (const [name, value] of Object.entries(variables)) {
    target.style.setProperty(name, value);
  }
}

const DARK_OVERRIDES_STYLE_ELEMENT_ID = "style-profile-dark-overrides";

function renderDarkOverridesStylesheet(variables: CssVariableMap): string {
  const declarations = Object.entries(variables)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join("\n");
  return `@media (prefers-color-scheme: dark) {\n  :root {\n${declarations}\n  }\n}`;
}

function applyDarkOverrides(profile: StyleProfile, doc: Document): void {
  const darkVariables = mapDarkStyleProfileToCssVariables(profile);
  const existing = doc.getElementById(DARK_OVERRIDES_STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!darkVariables) {
    existing?.remove();
    return;
  }

  const styleElement = existing ?? doc.createElement("style");
  styleElement.id = DARK_OVERRIDES_STYLE_ELEMENT_ID;
  styleElement.textContent = renderDarkOverridesStylesheet(darkVariables);
  if (!existing) {
    doc.head.appendChild(styleElement);
  }
}

/**
 * Applies a StyleProfile to the live document: sets the base CSS custom
 * properties on `root` and emits/updates/removes the `prefers-color-scheme:
 * dark` stylesheet for `colors.dark`. This is the ONE place that turns a
 * StyleProfile into an actual visual effect — used identically by app init
 * (frontend/src/main.tsx via StyleProfileContext) and by the Settings
 * page's per-keystroke live preview.
 */
export function applyStyleProfile(profile: StyleProfile, root: HTMLElement = document.documentElement): void {
  applyCssVariables(mapStyleProfileToCssVariables(profile), root);
  const doc = root.ownerDocument ?? document;
  applyDarkOverrides(profile, doc);
}
