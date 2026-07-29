export type ScoringFieldType = "counter" | "enum" | "boolean" | "number" | "note";

export type ScoringFieldInput = {
  key: string;
  type: ScoringFieldType;
  phase?: string | null;
  scoring_target?: string | null;
  points_per_unit?: number;
  points_per_option?: Readonly<Record<string, number>>;
};

export type ScoringProfileInput = {
  phases: readonly string[];
  fields: readonly ScoringFieldInput[];
};

export type EstimatedScore = {
  total: number;
  by_phase: Record<string, number>;
  by_target: Record<string, number>;
};

export type RecordValues = Readonly<Record<string, unknown>>;

function perUnitScore(value: unknown, pointsPerUnit: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (typeof pointsPerUnit !== "number" || !Number.isFinite(pointsPerUnit)) {
    return 0;
  }
  return value * pointsPerUnit;
}

function booleanScore(value: unknown, pointsPerUnit: number | undefined): number {
  if (value !== true || typeof pointsPerUnit !== "number" || !Number.isFinite(pointsPerUnit)) {
    return 0;
  }
  return pointsPerUnit;
}

function enumScore(value: unknown, pointsPerOption: Readonly<Record<string, number>> | undefined): number {
  if (typeof value !== "string" || !pointsPerOption || !Object.hasOwn(pointsPerOption, value)) {
    return 0;
  }
  const score = pointsPerOption[value];
  return Number.isFinite(score) ? score : 0;
}

function fieldScore(field: ScoringFieldInput, value: unknown): number {
  switch (field.type) {
    case "counter":
    case "number":
      return perUnitScore(value, field.points_per_unit);
    case "boolean":
      return booleanScore(value, field.points_per_unit);
    case "enum":
      return enumScore(value, field.points_per_option);
    case "note":
      return 0;
  }
}

export function calculateEstimatedScore(
  recordValues: RecordValues,
  profile: ScoringProfileInput
): EstimatedScore {
  const phaseScores = new Map(profile.phases.map((phase) => [phase, 0]));
  const targetScores = new Map<string, number>();
  let total = 0;

  for (const field of profile.fields) {
    const score = fieldScore(field, recordValues[field.key]);
    total += score;

    if (field.phase !== null && field.phase !== undefined) {
      phaseScores.set(field.phase, (phaseScores.get(field.phase) ?? 0) + score);
    }
    if (field.scoring_target !== null && field.scoring_target !== undefined) {
      targetScores.set(field.scoring_target, (targetScores.get(field.scoring_target) ?? 0) + score);
    }
  }

  return {
    total,
    by_phase: Object.fromEntries(phaseScores),
    by_target: Object.fromEntries(targetScores)
  };
}
