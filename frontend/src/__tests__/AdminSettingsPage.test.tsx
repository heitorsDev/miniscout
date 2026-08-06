/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../lib/api";
import { AdminSettingsPage } from "../pages/AdminSettingsPage";
import { stylePresets } from "../lib/stylePresets";
import type { StyleProfile } from "../lib/types";

vi.mock("../lib/api", () => ({
  api: {
    getStyleProfile: vi.fn(),
    updateStyleProfile: vi.fn()
  }
}));

const profile: StyleProfile = {
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
};

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getStyleProfile).mockResolvedValue(profile);
  });

  afterEach(() => {
    cleanup();
    document.getElementById("style-profile-dark-overrides")?.remove();
    document.documentElement.removeAttribute("style");
  });

  it("loads the active StyleProfile into the form", async () => {
    render(<AdminSettingsPage />);
    const nameInput = await screen.findByLabelText("Profile name") as HTMLInputElement;
    expect(nameInput.value).toBe("Pit-Crew Industrial");
    const accentInput = screen.getByLabelText("Accent") as HTMLInputElement;
    expect(accentInput.value.toLowerCase()).toBe("#ff6a00");
  });

  it("applies a color change to document.documentElement immediately, with no save required", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    const accentInput = await screen.findByLabelText("Accent") as HTMLInputElement;

    // input[type=color] doesn't support user.type(); fire a change directly.
    await user.click(accentInput);
    Object.defineProperty(accentInput, "value", { value: "#00ff00", configurable: true });
    accentInput.dispatchEvent(new Event("input", { bubbles: true }));
    accentInput.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("#00ff00");
    });
    expect(api.updateStyleProfile).not.toHaveBeenCalled();
  });

  it("saves the current form state via PUT and shows a persisted-baseline status", async () => {
    const user = userEvent.setup();
    const saved: StyleProfile = { ...profile, name: "Renamed" };
    vi.mocked(api.updateStyleProfile).mockResolvedValue(saved);

    render(<AdminSettingsPage />);
    const nameInput = await screen.findByLabelText("Profile name") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateStyleProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Renamed" }));
    });
    await screen.findByText("Style profile saved");
  });

  it("reveals a second color grid when the dark variant is enabled", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByLabelText("Profile name");

    expect(screen.queryByTestId("dark-color-grid")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Configure a dark variant/i));
    expect(screen.getByTestId("dark-color-grid")).toBeInTheDocument();
  });

  it("renders a labeled preset card for every bundled preset", async () => {
    render(<AdminSettingsPage />);
    await screen.findByLabelText("Profile name");

    for (const preset of stylePresets) {
      expect(screen.getByTestId(`style-preset-${preset.id}`)).toHaveTextContent(preset.label);
    }
  });

  it.each(stylePresets.map((preset) => [preset.id, preset] as const))(
    "selecting the %s preset replaces the form and live-applies its CSS variables",
    async (_id, preset) => {
      const user = userEvent.setup();
      render(<AdminSettingsPage />);
      const nameInput = await screen.findByLabelText("Profile name") as HTMLInputElement;
      expect(nameInput.value).toBe("Pit-Crew Industrial");

      await user.click(screen.getByTestId(`style-preset-${preset.id}`));

      await waitFor(() => {
        expect(nameInput.value).toBe(preset.profile.name);
      });
      expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe(preset.profile.colors.background);
      expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(preset.profile.colors.accent);
      expect(document.documentElement.style.getPropertyValue("--color-surface")).toBe(preset.profile.colors.surface);

      const accentInput = screen.getByLabelText("Accent") as HTMLInputElement;
      expect(accentInput.value.toLowerCase()).toBe(preset.profile.colors.accent.toLowerCase());

      // Presets are one-way starting templates: nothing is persisted by selecting one.
      expect(api.updateStyleProfile).not.toHaveBeenCalled();
    }
  );
});
