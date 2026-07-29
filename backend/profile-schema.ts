import { z } from "zod";

const nonEmptyString = z.string().trim().min(1, "must be a non-empty string");
const points = z.number({ invalid_type_error: "must be a number" }).finite("must be a finite number");
const fieldMetadata = {
  key: nonEmptyString,
  label: nonEmptyString,
  phase: nonEmptyString.nullable().optional(),
  scoring_target: nonEmptyString.nullable().optional()
};

const counterFieldSchema = z.object({
  ...fieldMetadata,
  type: z.literal("counter"),
  points_per_unit: points
}).strict();

const enumFieldSchema = z.object({
  ...fieldMetadata,
  type: z.literal("enum"),
  points_per_option: z.record(nonEmptyString, points).refine((options) => Object.keys(options).length > 0, "must include at least one option")
}).strict();

const booleanFieldSchema = z.object({
  ...fieldMetadata,
  type: z.literal("boolean"),
  points_per_unit: points
}).strict();

const numberFieldSchema = z.object({
  ...fieldMetadata,
  type: z.literal("number"),
  points_per_unit: points
}).strict();

const noteFieldSchema = z.object({
  ...fieldMetadata,
  type: z.literal("note")
}).strict();

export const scoringFieldSchema = z.discriminatedUnion("type", [
  counterFieldSchema,
  enumFieldSchema,
  booleanFieldSchema,
  numberFieldSchema,
  noteFieldSchema
]);

export const profileNameSchema = nonEmptyString.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "must contain only letters, numbers, dots, hyphens, or underscores");

export const scoringProfileSchema = z.object({
  name: profileNameSchema,
  version: nonEmptyString,
  alliance_size: z.union([z.literal(2), z.literal(3)]),
  phases: z.array(nonEmptyString),
  fields: z.array(scoringFieldSchema)
}).strict();

export type ScoringProfile = z.infer<typeof scoringProfileSchema>;

export type ProfileValidationError = {
  path: string;
  message: string;
  code: string;
};

export type ProfileValidationResult =
  | { success: true; data: ScoringProfile }
  | { success: false; errors: ProfileValidationError[] };

function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${segment}]`;
    }
    return result ? `${result}.${segment}` : segment;
  }, "");
}

export function validateScoringProfile(input: unknown): ProfileValidationResult {
  const result = scoringProfileSchema.safeParse(input);
  if (result.success) {
    return result;
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
