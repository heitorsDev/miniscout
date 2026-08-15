import type { ScoringProfile } from "./profile.types";

/**
 * Bundled default ScoringProfile: FRC 2025 REEFSCAPE presented by Haas.
 * Point values are Table 6-2 (Section 6 Game Details, game manual V13).
 * Demonstrates every field type the app supports (boolean, counter, enum,
 * note) against a real, well-documented game so a fresh install has
 * something to mint/scout/score immediately.
 */
export const defaultReefscapeProfile: ScoringProfile = {
  name: "reefscape-2025",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["auto", "teleop"],
  fields: [
    {
      key: "leave",
      label: "Left starting line",
      type: "boolean",
      phase: "auto",
      scoring_target: "mobility",
      points_per_unit: 3
    },
    {
      key: "coral_l1_auto",
      label: "Coral scored in trough (L1)",
      type: "counter",
      phase: "auto",
      scoring_target: "coral",
      points_per_unit: 3
    },
    {
      key: "coral_l2_auto",
      label: "Coral scored on L2 branch",
      type: "counter",
      phase: "auto",
      scoring_target: "coral",
      points_per_unit: 4
    },
    {
      key: "coral_l3_auto",
      label: "Coral scored on L3 branch",
      type: "counter",
      phase: "auto",
      scoring_target: "coral",
      points_per_unit: 6
    },
    {
      key: "coral_l4_auto",
      label: "Coral scored on L4 branch",
      type: "counter",
      phase: "auto",
      scoring_target: "coral",
      points_per_unit: 7
    },
    {
      key: "algae_processor_auto",
      label: "Algae scored in processor",
      type: "counter",
      phase: "auto",
      scoring_target: "algae",
      points_per_unit: 6
    },
    {
      key: "algae_net_auto",
      label: "Algae scored in net",
      type: "counter",
      phase: "auto",
      scoring_target: "algae",
      points_per_unit: 4
    },
    {
      key: "coral_l1_teleop",
      label: "Coral scored in trough (L1)",
      type: "counter",
      phase: "teleop",
      scoring_target: "coral",
      points_per_unit: 2
    },
    {
      key: "coral_l2_teleop",
      label: "Coral scored on L2 branch",
      type: "counter",
      phase: "teleop",
      scoring_target: "coral",
      points_per_unit: 3
    },
    {
      key: "coral_l3_teleop",
      label: "Coral scored on L3 branch",
      type: "counter",
      phase: "teleop",
      scoring_target: "coral",
      points_per_unit: 4
    },
    {
      key: "coral_l4_teleop",
      label: "Coral scored on L4 branch",
      type: "counter",
      phase: "teleop",
      scoring_target: "coral",
      points_per_unit: 5
    },
    {
      key: "algae_processor_teleop",
      label: "Algae scored in processor",
      type: "counter",
      phase: "teleop",
      scoring_target: "algae",
      points_per_unit: 6
    },
    {
      key: "algae_net_teleop",
      label: "Algae scored in net",
      type: "counter",
      phase: "teleop",
      scoring_target: "algae",
      points_per_unit: 4
    },
    {
      key: "endgame",
      label: "Endgame (barge)",
      type: "enum",
      phase: "teleop",
      scoring_target: "barge",
      points_per_option: {
        none: 0,
        park: 2,
        shallow_cage: 6,
        deep_cage: 12
      }
    },
    {
      key: "notes",
      label: "Notes",
      type: "note",
      phase: null
    }
  ]
};
