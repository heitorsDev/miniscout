import type { StyleProfile } from "./types";

/**
 * Bundled "start from a preset" gallery for the admin Settings page (#26).
 *
 * These are static, ship-with-the-app starting templates — NOT admin-editable,
 * NOT persisted as their own entities, and NOT reachable through any API
 * endpoint. Selecting one only replaces the in-progress form state in
 * AdminSettingsPage; saving still writes through the existing single active
 * StyleProfile file via PUT /api/admin/style-profile.
 *
 * Every profile here must be a COMPLETE, schema-valid StyleProfile matching
 * backend/features/style-profile/style-profile.schema.ts exactly — see
 * stylePresets.test.ts, which validates each preset against that real zod
 * schema.
 */
export type StylePreset = {
  id: string;
  label: string;
  profile: StyleProfile;
};

export const stylePresets: StylePreset[] = [
  {
    id: "pit-crew-industrial",
    label: "Pit-Crew Industrial",
    // Exactly the bundled default from backend/features/style-profile/style-profile.defaults.ts
    // so selecting this preset reproduces the true out-of-box look.
    profile: {
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
    }
  },
  {
    id: "unimate",
    label: "Unimate",
    profile: {
      name: "Unimate",
      colors: {
        background: "#000000",
        surface: "#141018",
        text: "#f5f2fa",
        textMuted: "#a89fc0",
        accent: "#8b5cf6",
        accentContrast: "#ffffff",
        border: "#2a2333",
        danger: "#ef4444",
        success: "#22c55e"
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
        radius: "rounded",
        density: "compact"
      }
    }
  },
  {
    id: "blueprint",
    label: "Blueprint",
    profile: {
      name: "Blueprint",
      colors: {
        background: "#f4f7fb",
        surface: "#ffffff",
        text: "#16232e",
        textMuted: "#5b6b7a",
        accent: "#1e6fd9",
        accentContrast: "#ffffff",
        border: "#c9d6e3",
        danger: "#d64545",
        success: "#1f9d55"
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
    }
  },
  {
    id: "circuit",
    label: "Circuit",
    profile: {
      name: "Circuit",
      colors: {
        background: "#0a0f0a",
        surface: "#111811",
        text: "#d9ffe6",
        textMuted: "#7fae8c",
        accent: "#39ff14",
        accentContrast: "#03150a",
        border: "#1c3324",
        danger: "#ff4d4d",
        success: "#00e090"
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
    }
  },
  {
    id: "alliance-red",
    label: "Alliance Red",
    profile: {
      name: "Alliance Red",
      colors: {
        background: "#f7f7f5",
        surface: "#ffffff",
        text: "#1f1a1a",
        textMuted: "#6b5f5f",
        accent: "#c8102e",
        accentContrast: "#ffffff",
        border: "#e0d5d5",
        danger: "#b3261e",
        success: "#1f8a4c"
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
        radius: "rounded",
        density: "spacious"
      }
    }
  },
  {
    id: "sandstone",
    label: "Sandstone",
    profile: {
      name: "Sandstone",
      colors: {
        background: "#f2e8dc",
        surface: "#fbf5ec",
        text: "#4a3b31",
        textMuted: "#8a7566",
        accent: "#c1602f",
        accentContrast: "#fff8f0",
        border: "#ddccb8",
        danger: "#b3413a",
        success: "#6b8f52"
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
        radius: "rounded",
        density: "spacious"
      }
    }
  }
];
