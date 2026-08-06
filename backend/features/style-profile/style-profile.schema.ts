import { z } from "zod";
import type { StyleProfileValidationResult, StyleProfile } from "./style-profile.types";

const nonEmptyString = z.string().trim().min(1, "must be a non-empty string");

const CSS_COLOR_PATTERN = /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|rgba|hsl|hsla)\([^)]*\))$/;

const colorSchema = nonEmptyString.regex(
  CSS_COLOR_PATTERN,
  "must be a hex color (e.g. #14161a) or an rgb()/rgba()/hsl()/hsla() value"
);

const DATA_URI_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

const colorFields = {
  background: colorSchema,
  surface: colorSchema,
  text: colorSchema,
  textMuted: colorSchema,
  accent: colorSchema,
  accentContrast: colorSchema,
  border: colorSchema,
  danger: colorSchema,
  success: colorSchema
};

const darkColorsSchema = z.object(colorFields).partial().strict();

export const colorsSchema = z.object({
  ...colorFields,
  dark: darkColorsSchema.optional()
}).strict();

export const fontUiSchema = z.enum(["inter"]);
export const fontMonoSchema = z.enum(["jetbrains-mono"]);

export const typographySchema = z.object({
  fontUi: fontUiSchema,
  fontMono: fontMonoSchema
}).strict();

export const logoSchema = z.object({
  dataUri: z.union([
    z.string().regex(DATA_URI_PATTERN, "must be a base64 image data URI (e.g. data:image/png;base64,...)"),
    z.null()
  ]),
  teamName: z.string()
}).strict();

export const shapeSchema = z.object({
  radius: z.enum(["sharp", "rounded"]),
  density: z.enum(["compact", "spacious"])
}).strict();

export const styleProfileSchema = z.object({
  name: nonEmptyString,
  colors: colorsSchema,
  typography: typographySchema,
  logo: logoSchema,
  shape: shapeSchema
}).strict();

function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${segment}]`;
    }
    return result ? `${result}.${segment}` : segment;
  }, "");
}

export function validateStyleProfile(input: unknown): StyleProfileValidationResult {
  const result = styleProfileSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as StyleProfile };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
      code: issue.code
    }))
  };
}
