export type ScoringFieldBase = {
  key: string;
  label: string;
  phase?: string | null;
  scoring_target?: string | null;
};

export type CounterField = ScoringFieldBase & {
  type: "counter";
  points_per_unit: number;
};

export type EnumField = ScoringFieldBase & {
  type: "enum";
  points_per_option: Record<string, number>;
};

export type BooleanField = ScoringFieldBase & {
  type: "boolean";
  points_per_unit: number;
};

export type NumberField = ScoringFieldBase & {
  type: "number";
  points_per_unit: number;
};

export type NoteField = ScoringFieldBase & {
  type: "note";
};

export type ScoringField = CounterField | EnumField | BooleanField | NumberField | NoteField;

export type ScoringProfile = {
  name: string;
  version: string;
  alliance_size: 2 | 3;
  phases: string[];
  fields: ScoringField[];
};

export type FieldValue = number | string | boolean | null;

export type DraftValue = Record<string, FieldValue>;

export type ScouterDraft = {
  scouter_name: string;
  match_number: string;
  team_number: string;
  values: DraftValue;
  updated_at?: string;
};

export type Competition = {
  _id: string;
  name: string;
  scoring_profile_name: string;
  qr_token: string;
  qr_url: string;
  created_at: string;
  current_match_number?: number;
};

export type ScoutRecord = {
  _id: string;
  competition_id: string;
  match_number: string;
  team_number: string;
  scouter_name: string;
  scouter_cookie_id: string;
  values: DraftValue;
  submitted_at: string;
};

export type EstimatedScore = { total: number; by_phase: Record<string, number>; by_target: Record<string, number> };
export type AggregatedField = { value: unknown; no_consensus: boolean };
export type ScoutGroupSummary = { match_number: string; team_number: string; record_count: number; multi_scouted: boolean; aggregated_total: number };
export type ScoutGroup = ScoutGroupSummary & {
  records: Array<ScoutRecord & { estimated_score: EstimatedScore }>;
  aggregated: { total: number; fields: Record<string, AggregatedField> };
};

export type OfficialScore = {
  _id: string;
  competition_id: string;
  match_number: string;
  red_score: number;
  blue_score: number;
  updated_at: string;
};

export type TeamMatchRollup = {
  match_number: string;
  record_count: number;
  median_estimated_score: number;
};

export type TeamRollup = {
  team_number: string;
  record_count: number;
  matches_scouted: string[];
  matches: TeamMatchRollup[];
};

// StyleProfile types mirror backend/features/style-profile/style-profile.schema.ts
// field-for-field so the frontend can consume GET /api/style-profile and PUT
// /api/admin/style-profile without a translation layer.
export type StyleProfileColorKey =
  | "background"
  | "surface"
  | "text"
  | "textMuted"
  | "accent"
  | "accentContrast"
  | "border"
  | "danger"
  | "success";

export type StyleProfileColors = Record<StyleProfileColorKey, string> & {
  dark?: Partial<Record<StyleProfileColorKey, string>>;
};

export type StyleProfileFontUi = "inter";
export type StyleProfileFontMono = "jetbrains-mono";

export const STYLE_PROFILE_FONT_UI_OPTIONS: readonly StyleProfileFontUi[] = ["inter"];
export const STYLE_PROFILE_FONT_MONO_OPTIONS: readonly StyleProfileFontMono[] = ["jetbrains-mono"];

export type StyleProfileTypography = {
  fontUi: StyleProfileFontUi;
  fontMono: StyleProfileFontMono;
};

export type StyleProfileLogo = {
  dataUri: string | null;
  teamName: string;
};

export type StyleProfileShapeRadius = "sharp" | "rounded";
export type StyleProfileShapeDensity = "compact" | "spacious";

export const STYLE_PROFILE_RADIUS_OPTIONS: readonly StyleProfileShapeRadius[] = ["sharp", "rounded"];
export const STYLE_PROFILE_DENSITY_OPTIONS: readonly StyleProfileShapeDensity[] = ["compact", "spacious"];

export type StyleProfileShape = {
  radius: StyleProfileShapeRadius;
  density: StyleProfileShapeDensity;
};

export type StyleProfile = {
  name: string;
  colors: StyleProfileColors;
  typography: StyleProfileTypography;
  logo: StyleProfileLogo;
  shape: StyleProfileShape;
};

export function defaultValueForField(field: ScoringField): FieldValue {
  switch (field.type) {
    case "counter":
      return 0;
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return Object.keys(field.points_per_option)[0] ?? "";
    case "note":
      return "";
    default:
      return null;
  }
}
