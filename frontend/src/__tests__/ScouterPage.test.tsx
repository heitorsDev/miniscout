/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import { ScouterPage } from "../pages/ScouterPage";
import type { ScoringProfile } from "../lib/types";

vi.mock("../lib/api", () => ({
  api: {
    lookupCompetition: vi.fn(),
    fetchScouterSelf: vi.fn(),
    loadDraft: vi.fn(),
    saveDraft: vi.fn(),
    submitRecord: vi.fn(),
    registerScouter: vi.fn()
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
      this.name = "ApiError";
    }
  }
}));

const profile: ScoringProfile = {
  name: "test-profile",
  version: "1.0.0",
  alliance_size: 3,
  phases: ["teleop"],
  fields: [
    { key: "cycles", label: "Cycles", type: "counter", phase: "teleop", points_per_unit: 1 },
    { key: "quality", label: "Quality", type: "enum", phase: "teleop", points_per_option: { low: 0, high: 4 } },
    { key: "left", label: "Left zone", type: "boolean", phase: "teleop", points_per_unit: 3 },
    { key: "time", label: "Match time", type: "number", phase: "teleop", points_per_unit: 1 },
    { key: "notes", label: "Notes", type: "note" }
  ]
};

function setupAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/scout" element={<ScouterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ScouterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.lookupCompetition).mockResolvedValue({
      competition: { _id: "cmp_1", name: "Spring 2026", scoring_profile_name: "test-profile", qr_token: "abc" },
      profile
    });
    vi.mocked(api.fetchScouterSelf).mockResolvedValue(null);
    vi.mocked(api.loadDraft).mockResolvedValue({ draft: null });
    vi.mocked(api.saveDraft).mockResolvedValue({
      draft: {
        scouter_name: "Alice",
        match_number: "",
        team_number: "",
        values: {},
        updated_at: new Date().toISOString()
      }
    });
    vi.mocked(api.registerScouter).mockResolvedValue({ scouter_cookie_id: "sct_1", scouter_name: "Alice" });
    vi.mocked(api.submitRecord).mockResolvedValue({ record_id: "rec_1" });
  });

  afterEach(() => cleanup());

  it("prompts for a display name on first visit", async () => {
    setupAt("/scout?c=abc");
    await screen.findByText(/Spring 2026/);
    expect(screen.getByLabelText(/Display name/i)).toBeInTheDocument();
  });

  it("renders the typed form after registering a name", async () => {
    const user = userEvent.setup();
    setupAt("/scout?c=abc");
    const nameInput = await screen.findByLabelText(/Display name/i);
    await user.type(nameInput, "Alice");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Spring 2026/ })).toBeInTheDocument();
    });
    expect(screen.getByTestId("scouter-name")).toHaveTextContent("Alice");

    expect(document.querySelector('[data-field-key="cycles"][data-field-type="counter"]')).toBeInTheDocument();
    expect(document.querySelector('[data-field-key="quality"][data-field-type="enum"]')).toBeInTheDocument();
    expect(document.querySelector('[data-field-key="left"][data-field-type="boolean"]')).toBeInTheDocument();
    expect(document.querySelector('[data-field-key="time"][data-field-type="number"]')).toBeInTheDocument();
    expect(document.querySelector('[data-field-key="notes"][data-field-type="note"]')).toBeInTheDocument();
  });

  it("submits a record with form values converted to raw field values", async () => {
    const user = userEvent.setup();
    setupAt("/scout?c=abc");
    const nameInput = await screen.findByLabelText(/Display name/i);
    await user.type(nameInput, "Alice");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    await screen.findByTestId("scouter-name");
    await user.type(screen.getByLabelText(/Match number/i), "12");
    await user.type(screen.getByLabelText(/Team number/i), "34");
    await user.click(screen.getByRole("button", { name: /Increase Cycles/i }));
    await user.click(screen.getByRole("button", { name: /Increase Cycles/i }));
    await user.click(screen.getByLabelText("high"));
    await user.click(screen.getByLabelText(/Left zone/i));
    await user.type(screen.getByLabelText("Notes"), "moved fast");

    await user.click(screen.getByRole("button", { name: /Submit record/i }));

    await waitFor(() => {
      expect(api.submitRecord).toHaveBeenCalledWith("abc", {
        scouter_name: "Alice",
        match_number: "12",
        team_number: "34",
        values: expect.objectContaining({
          cycles: 2,
          quality: "high",
          left: true,
          notes: "moved fast"
        })
      });
    });
  });
});
