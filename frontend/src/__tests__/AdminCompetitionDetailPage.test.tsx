/// <reference types="vitest" />
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import { AdminCompetitionDetailPage } from "../pages/AdminCompetitionDetailPage";
import type { Competition, ScoutGroup, ScoutGroupSummary } from "../lib/types";

vi.mock("../lib/api", () => ({
  api: {
    listAdminCompetitions: vi.fn(),
    listAdminGroups: vi.fn(),
    getAdminGroup: vi.fn(),
    listOfficialScores: vi.fn(),
    upsertOfficialScore: vi.fn(),
    deleteAdminRecord: vi.fn()
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
      this.name = "ApiError";
    }
  }
}));

const competition: Competition = {
  _id: "cmp_1",
  name: "Spring 2026",
  scoring_profile_name: "test-profile",
  qr_token: "abc",
  created_at: new Date().toISOString()
};

function makeGroup(matchNumber: string, teamNumber: string): ScoutGroupSummary {
  return { match_number: matchNumber, team_number: teamNumber, record_count: 1, multi_scouted: false, aggregated_total: 10 };
}

function toFullGroup(summary: ScoutGroupSummary): ScoutGroup {
  return { ...summary, records: [], aggregated: { total: summary.aggregated_total, fields: {} } };
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/admin/competitions/cmp_1"]}>
      <Routes>
        <Route path="/admin/competitions/:id" element={<AdminCompetitionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminCompetitionDetailPage", () => {
  afterEach(() => cleanup());

  it("populates the official-match datalist with distinct, sorted match numbers from ScoutRecord groups", async () => {
    vi.clearAllMocks();
    const groups = [makeGroup("10", "111"), makeGroup("2", "222"), makeGroup("2", "333"), makeGroup("1", "111")];
    vi.mocked(api.listAdminCompetitions).mockResolvedValue({ competitions: [competition] });
    vi.mocked(api.listAdminGroups).mockResolvedValue({ groups });
    vi.mocked(api.getAdminGroup).mockImplementation((_id, matchNumber, teamNumber) =>
      Promise.resolve({ group: toFullGroup(groups.find((g) => g.match_number === matchNumber && g.team_number === teamNumber)!) })
    );
    vi.mocked(api.listOfficialScores).mockResolvedValue({ official_scores: [] });

    setup();

    await screen.findByText("Spring 2026");

    const input = screen.getByTestId("official-match-input") as HTMLInputElement;
    expect(input.getAttribute("list")).toBe("official-match-options");

    await waitFor(() => {
      const datalist = document.getElementById("official-match-options") as HTMLDataListElement;
      const values = Array.from(datalist.options).map((option) => option.value);
      expect(values).toEqual(["1", "2", "10"]);
    });
  });

  it("renders an empty datalist without erroring when there are no ScoutRecord groups yet", async () => {
    vi.clearAllMocks();
    vi.mocked(api.listAdminCompetitions).mockResolvedValue({ competitions: [competition] });
    vi.mocked(api.listAdminGroups).mockResolvedValue({ groups: [] });
    vi.mocked(api.listOfficialScores).mockResolvedValue({ official_scores: [] });

    setup();

    await screen.findByText("Spring 2026");

    const input = screen.getByTestId("official-match-input") as HTMLInputElement;
    expect(input.getAttribute("list")).toBe("official-match-options");
    const datalist = document.getElementById("official-match-options") as HTMLDataListElement;
    expect(datalist.options.length).toBe(0);
  });
});
