import { describe, expect, it } from "vitest";
import {
  calculateEstimatedScore,
  type ScoringFieldInput,
  type ScoringProfileInput
} from "./scoring";

function profile(fields: ScoringFieldInput[], phases = ["teleop"]): ScoringProfileInput {
  return {
    phases,
    fields
  };
}

function counter(overrides: Partial<ScoringFieldInput> = {}): ScoringFieldInput {
  return {
    key: "cycles",
    type: "counter",
    phase: "teleop",
    scoring_target: "basket",
    points_per_unit: 2,
    ...overrides
  };
}

function numberField(overrides: Partial<ScoringFieldInput> = {}): ScoringFieldInput {
  return {
    key: "speed",
    type: "number",
    phase: "teleop",
    scoring_target: "mobility",
    points_per_unit: 1.5,
    ...overrides
  };
}

function booleanField(overrides: Partial<ScoringFieldInput> = {}): ScoringFieldInput {
  return {
    key: "leave",
    type: "boolean",
    phase: "auto",
    scoring_target: "mobility",
    points_per_unit: 3,
    ...overrides
  };
}

function enumField(overrides: Partial<ScoringFieldInput> = {}): ScoringFieldInput {
  return {
    key: "ascent",
    type: "enum",
    phase: "endgame",
    scoring_target: "climb",
    points_per_option: {
      none: 0,
      low: 3,
      high: 8
    },
    ...overrides
  };
}

function noteField(overrides: Partial<ScoringFieldInput> = {}): ScoringFieldInput {
  return {
    key: "notes",
    type: "note",
    phase: null,
    scoring_target: null,
    ...overrides
  };
}

describe("calculateEstimatedScore counter fields", () => {
  it("multiplies counter value by points per unit", () => {
    expect(calculateEstimatedScore({ cycles: 4 }, profile([counter()]))).toEqual({
      total: 8,
      by_phase: { teleop: 8 },
      by_target: { basket: 8 }
    });
  });

  it("scores a zero counter as zero", () => {
    expect(calculateEstimatedScore({ cycles: 0 }, profile([counter()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { basket: 0 }
    });
  });

  it("supports fractional counter values", () => {
    expect(calculateEstimatedScore({ cycles: 1.5 }, profile([counter({ points_per_unit: 3 })]))).toEqual({
      total: 4.5,
      by_phase: { teleop: 4.5 },
      by_target: { basket: 4.5 }
    });
  });

  it("supports negative counter values", () => {
    expect(calculateEstimatedScore({ cycles: -2 }, profile([counter({ points_per_unit: 3 })]))).toEqual({
      total: -6,
      by_phase: { teleop: -6 },
      by_target: { basket: -6 }
    });
  });

  it("scores a missing counter value as zero", () => {
    expect(calculateEstimatedScore({}, profile([counter()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { basket: 0 }
    });
  });

  it("scores a non-numeric counter value as zero", () => {
    expect(calculateEstimatedScore({ cycles: "4" }, profile([counter()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { basket: 0 }
    });
  });

  it("scores a counter without points per unit as zero", () => {
    expect(calculateEstimatedScore({ cycles: 4 }, profile([counter({ points_per_unit: undefined })]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { basket: 0 }
    });
  });

  it("supports zero points per unit", () => {
    expect(calculateEstimatedScore({ cycles: 4 }, profile([counter({ points_per_unit: 0 })]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { basket: 0 }
    });
  });
});

describe("calculateEstimatedScore number fields", () => {
  it("multiplies number value by points per unit", () => {
    expect(calculateEstimatedScore({ speed: 4 }, profile([numberField()]))).toEqual({
      total: 6,
      by_phase: { teleop: 6 },
      by_target: { mobility: 6 }
    });
  });

  it("supports fractional points per unit", () => {
    expect(calculateEstimatedScore({ speed: 2.5 }, profile([numberField({ points_per_unit: 0.4 })]))).toEqual({
      total: 1,
      by_phase: { teleop: 1 },
      by_target: { mobility: 1 }
    });
  });

  it("scores a number without points per unit as zero", () => {
    expect(calculateEstimatedScore({ speed: 4 }, profile([numberField({ points_per_unit: undefined })]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("scores a non-numeric number value as zero", () => {
    expect(calculateEstimatedScore({ speed: "4" }, profile([numberField()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("scores a non-finite number value as zero", () => {
    expect(calculateEstimatedScore({ speed: Number.POSITIVE_INFINITY }, profile([numberField()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { mobility: 0 }
    });
  });
});

describe("calculateEstimatedScore boolean fields", () => {
  it("awards points per unit when boolean value is true", () => {
    expect(calculateEstimatedScore({ leave: true }, profile([booleanField()], ["auto"]))).toEqual({
      total: 3,
      by_phase: { auto: 3 },
      by_target: { mobility: 3 }
    });
  });

  it("scores false as zero", () => {
    expect(calculateEstimatedScore({ leave: false }, profile([booleanField()], ["auto"]))).toEqual({
      total: 0,
      by_phase: { auto: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("scores a missing boolean value as zero", () => {
    expect(calculateEstimatedScore({}, profile([booleanField()], ["auto"]))).toEqual({
      total: 0,
      by_phase: { auto: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("does not treat truthy values as true", () => {
    expect(calculateEstimatedScore({ leave: "true" }, profile([booleanField()], ["auto"]))).toEqual({
      total: 0,
      by_phase: { auto: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("scores true without points per unit as zero", () => {
    expect(calculateEstimatedScore(
      { leave: true },
      profile([booleanField({ points_per_unit: undefined })], ["auto"])
    )).toEqual({
      total: 0,
      by_phase: { auto: 0 },
      by_target: { mobility: 0 }
    });
  });

  it("supports negative boolean points", () => {
    expect(calculateEstimatedScore(
      { leave: true },
      profile([booleanField({ points_per_unit: -2 })], ["auto"])
    )).toEqual({
      total: -2,
      by_phase: { auto: -2 },
      by_target: { mobility: -2 }
    });
  });
});

describe("calculateEstimatedScore enum fields", () => {
  it("looks up selected option points", () => {
    expect(calculateEstimatedScore({ ascent: "high" }, profile([enumField()], ["endgame"]))).toEqual({
      total: 8,
      by_phase: { endgame: 8 },
      by_target: { climb: 8 }
    });
  });

  it("defaults an unscored option to zero", () => {
    expect(calculateEstimatedScore({ ascent: "parked" }, profile([enumField()], ["endgame"]))).toEqual({
      total: 0,
      by_phase: { endgame: 0 },
      by_target: { climb: 0 }
    });
  });

  it("scores an enum without points per option as zero", () => {
    expect(calculateEstimatedScore(
      { ascent: "high" },
      profile([enumField({ points_per_option: undefined })], ["endgame"])
    )).toEqual({
      total: 0,
      by_phase: { endgame: 0 },
      by_target: { climb: 0 }
    });
  });

  it("scores a missing enum value as zero", () => {
    expect(calculateEstimatedScore({}, profile([enumField()], ["endgame"]))).toEqual({
      total: 0,
      by_phase: { endgame: 0 },
      by_target: { climb: 0 }
    });
  });

  it("scores a non-string enum value as zero", () => {
    expect(calculateEstimatedScore({ ascent: 8 }, profile([enumField()], ["endgame"]))).toEqual({
      total: 0,
      by_phase: { endgame: 0 },
      by_target: { climb: 0 }
    });
  });

  it("supports an explicitly zero-valued option", () => {
    expect(calculateEstimatedScore({ ascent: "none" }, profile([enumField()], ["endgame"]))).toEqual({
      total: 0,
      by_phase: { endgame: 0 },
      by_target: { climb: 0 }
    });
  });

  it("supports negative enum option points", () => {
    expect(calculateEstimatedScore(
      { ascent: "failed" },
      profile([enumField({ points_per_option: { failed: -4 } })], ["endgame"])
    )).toEqual({
      total: -4,
      by_phase: { endgame: -4 },
      by_target: { climb: -4 }
    });
  });
});

describe("calculateEstimatedScore note fields", () => {
  it("does not score note text", () => {
    expect(calculateEstimatedScore({ notes: "Fast cycles" }, profile([noteField()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: {}
    });
  });

  it("does not score a numeric note value", () => {
    expect(calculateEstimatedScore({ notes: 12 }, profile([noteField()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: {}
    });
  });

  it("ignores scoring metadata on a note", () => {
    expect(calculateEstimatedScore(
      { notes: "Climbed" },
      profile([noteField({ phase: "teleop", scoring_target: "climb", points_per_unit: 50 })])
    )).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: { climb: 0 }
    });
  });

  it("scores a missing note as zero", () => {
    expect(calculateEstimatedScore({}, profile([noteField()]))).toEqual({
      total: 0,
      by_phase: { teleop: 0 },
      by_target: {}
    });
  });
});
