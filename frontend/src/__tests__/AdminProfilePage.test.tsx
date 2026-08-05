/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../lib/api";
import { AdminProfilePage } from "../pages/AdminProfilePage";

vi.mock("../lib/api", () => ({
  api: {
    listProfiles: vi.fn()
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
      this.name = "ApiError";
    }
  }
}));

function mockFetchResponse(body: unknown, init: { ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    json: async () => body
  } as Response;
}

describe("AdminProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/scouter/competition/")) {
          return Promise.resolve(mockFetchResponse({ current_match_number: null }));
        }
        if (url.includes("/api/admin/profiles/")) {
          return Promise.resolve(mockFetchResponse({ name: "beta", version: "1.0.0" }));
        }
        return Promise.resolve(mockFetchResponse({}));
      })
    );
  });

  afterEach(() => cleanup());

  it("populates the profile dropdown from api.listProfiles", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: ["alpha", "beta"] });
    render(<AdminProfilePage />);

    const select = await screen.findByLabelText("Profile name") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.querySelectorAll("option")).toHaveLength(2);
    });
    expect(screen.getByRole("option", { name: "alpha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fetch profile" })).toBeEnabled();
  });

  it("shows an empty-state message and disables Fetch when no profiles exist", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: [] });
    render(<AdminProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/No profiles uploaded yet/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Profile name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fetch profile" })).toBeDisabled();
  });

  it("fetches the selected profile against the currently selected dropdown value", async () => {
    vi.mocked(api.listProfiles).mockResolvedValue({ profiles: ["alpha", "beta"] });
    const user = userEvent.setup();
    render(<AdminProfilePage />);

    const select = await screen.findByLabelText("Profile name") as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll("option")).toHaveLength(2));

    await user.selectOptions(select, "beta");
    await user.click(screen.getByRole("button", { name: "Fetch profile" }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/admin/profiles/beta");
    });
    await screen.findByText("Profile fetched");
  });
});
