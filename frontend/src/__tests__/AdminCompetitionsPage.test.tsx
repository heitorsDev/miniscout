/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import { AdminCompetitionsPage } from "../pages/AdminCompetitionsPage";

vi.mock("../lib/api", () => ({
  api: {
    listAdminCompetitions: vi.fn(),
    listProfiles: vi.fn(),
    mintCompetition: vi.fn(),
    getTunnelUrl: vi.fn()
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
      this.name = "ApiError";
    }
  }
}));

function setup() {
  return render(
    <MemoryRouter>
      <AdminCompetitionsPage />
    </MemoryRouter>
  );
}

describe("AdminCompetitionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listAdminCompetitions).mockResolvedValue({ competitions: [] });
    vi.mocked(api.getTunnelUrl).mockRejectedValue(new Error("not found"));
  });

  afterEach(() => cleanup());

  it("populates the ScoringProfile dropdown from api.listProfiles", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: ["alpha", "beta"] });
    setup();

    const select = await screen.findByLabelText("ScoringProfile name") as HTMLSelectElement;
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "alpha" })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "beta" })).toBeInTheDocument();
    expect(select).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mint competition" })).toBeEnabled();
  });

  it("shows an empty-state message and disables minting when no profiles exist", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: [] });
    setup();

    await waitFor(() => {
      expect(screen.getByText(/No ScoringProfiles uploaded yet/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("ScoringProfile name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mint competition" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Profile page" })).toHaveAttribute("href", "/admin");
  });

  it("submits the selected ScoringProfile name when minting a competition", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: ["alpha", "beta"] });
    vi.mocked(api.mintCompetition).mockResolvedValue({
      competition: {
        _id: "cmp_1",
        name: "Spring 2026",
        scoring_profile_name: "beta",
        qr_token: "abc",
        qr_url: "http://example.test/scout?c=abc",
        created_at: new Date().toISOString()
      },
      qr_url: "http://example.test/scout?c=abc"
    });
    const user = userEvent.setup();
    setup();

    const select = await screen.findByLabelText("ScoringProfile name") as HTMLSelectElement;
    await waitFor(() => expect(screen.getByRole("option", { name: "beta" })).toBeInTheDocument());

    await user.type(screen.getByLabelText("Competition name"), "Spring 2026");
    await user.selectOptions(select, "beta");
    await user.type(screen.getByLabelText("LAN scouter URL"), "http://192.168.1.10:8082");
    await user.click(screen.getByRole("button", { name: "Mint competition" }));

    await waitFor(() => {
      expect(api.mintCompetition).toHaveBeenCalledWith({
        name: "Spring 2026",
        scoring_profile_name: "beta",
        lan_base_url: "http://192.168.1.10:8082"
      });
    });
  });

  it("prefills the LAN scouter URL from api.getTunnelUrl", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: [] });
    vi.mocked(api.getTunnelUrl).mockResolvedValue({ url: "https://random-words.trycloudflare.com" });
    setup();

    await waitFor(() => {
      expect(screen.getByLabelText("LAN scouter URL")).toHaveValue("https://random-words.trycloudflare.com");
    });
  });

  it("shows a warning and leaves the field empty when no tunnel is available", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: [] });
    setup();

    await waitFor(() => {
      expect(screen.getByText(/No public tunnel detected/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("LAN scouter URL")).toHaveValue("");
  });
});
