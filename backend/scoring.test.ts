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
