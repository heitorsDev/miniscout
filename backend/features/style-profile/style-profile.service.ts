import { defaultStyleProfile } from "./style-profile.defaults";
import { validateStyleProfile } from "./style-profile.schema";
import { StyleProfileNotFoundError } from "./style-profile.repository";
import type { StyleProfileRepository } from "./style-profile.repository";
import type { StyleProfile } from "./style-profile.types";

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDefined<T extends PlainObject>(defaults: T, override: unknown): T {
  if (!isPlainObject(override)) {
    return { ...defaults };
  }
  const merged: PlainObject = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = override[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

const COLOR_FIELD_KEYS = [
  "background",
  "surface",
  "text",
  "textMuted",
  "accent",
  "accentContrast",
  "border",
  "danger",
  "success"
] as const;

function mergeDarkColors(defaultDark: unknown, overrideDark: unknown): PlainObject | undefined {
  const defaultObject = isPlainObject(defaultDark) ? defaultDark : {};
  const overrideObject = isPlainObject(overrideDark) ? overrideDark : {};
  if (Object.keys(defaultObject).length === 0 && Object.keys(overrideObject).length === 0) {
    return undefined;
  }

  const merged: PlainObject = {};
  for (const key of COLOR_FIELD_KEYS) {
    const value = overrideObject[key] ?? defaultObject[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeColors(defaults: StyleProfile["colors"], override: unknown): StyleProfile["colors"] {
  const { dark: defaultDark, ...defaultBase } = defaults;
  const overrideObject = isPlainObject(override) ? override : {};
  const mergedBase = mergeDefined(defaultBase, overrideObject);

  const mergedDark = mergeDarkColors(defaultDark, overrideObject.dark);
  if (!mergedDark) {
    return mergedBase;
  }
  return { ...mergedBase, dark: mergedDark } as StyleProfile["colors"];
}

/**
 * Fills in any missing/partial fields of a (possibly incomplete or legacy)
 * stored StyleProfile with the bundled default's values, field-by-field.
 * This is the single place fallback-to-default logic lives; callers should
 * not scatter `?? default.foo` checks elsewhere.
 */
export function mergeWithDefaultStyleProfile(
  input: unknown,
  defaults: StyleProfile = defaultStyleProfile
): StyleProfile {
  const source = isPlainObject(input) ? input : {};
  const name = typeof source.name === "string" && source.name.trim().length > 0 ? source.name : defaults.name;

  return {
    name,
    colors: mergeColors(defaults.colors, source.colors),
    typography: mergeDefined(defaults.typography, source.typography),
    logo: mergeDefined(defaults.logo, source.logo),
    shape: mergeDefined(defaults.shape, source.shape)
  };
}

/**
 * Loads the single active StyleProfile, falling back to the bundled
 * default whenever no file has been saved yet or the saved file is
 * missing/invalid fields.
 */
export async function loadActiveStyleProfile(repository: StyleProfileRepository): Promise<StyleProfile> {
  let raw: unknown;
  try {
    raw = await repository.load();
  } catch (error) {
    if (!(error instanceof StyleProfileNotFoundError)) {
      throw error;
    }
    raw = undefined;
  }

  const merged = mergeWithDefaultStyleProfile(raw);
  const result = validateStyleProfile(merged);
  return result.success ? result.data : defaultStyleProfile;
}
