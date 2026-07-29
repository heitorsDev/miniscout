import type {
  Competition,
  DraftValue,
  ScoutGroup,
  ScoutGroupSummary,
  ScoringProfile,
  ScouterDraft
} from "./types";

export type ApiErrorBody = {
  error?: string;
  errors?: Array<{ path: string; message: string; code: string }>;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    const detail = errorBody.errors?.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new ApiError(detail || errorBody.error || `Request failed: ${response.status}`, response.status);
  }
  return body as T;
}

async function request<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    credentials: "include"
  });
  return parseResponse<T>(response);
}

export type CompetitionLookupResponse = {
  competition: {
    _id: string;
    name: string;
    scoring_profile_name: string;
    qr_token: string;
  };
  profile: ScoringProfile;
};

export const api = {
  listAdminCompetitions(): Promise<{ competitions: Competition[] }> {
    return request("/api/admin/competitions");
  },
  mintCompetition(input: { name: string; scoring_profile_name: string; lan_base_url: string }): Promise<{
    competition: Competition;
    qr_url: string;
  }> {
    return request("/api/admin/competitions", { method: "POST", body: JSON.stringify(input) });
  },
  listAdminGroups(competitionId: string): Promise<{ groups: ScoutGroupSummary[] }> {
    return request(`/api/admin/competitions/${encodeURIComponent(competitionId)}/records`);
  },
  getAdminGroup(competitionId: string, matchNumber: string, teamNumber: string): Promise<{ group: ScoutGroup }> {
    return request(`/api/admin/competitions/${encodeURIComponent(competitionId)}/groups/${encodeURIComponent(matchNumber)}/${encodeURIComponent(teamNumber)}`);
  },
  lookupCompetition(token: string): Promise<CompetitionLookupResponse> {
    return request(`/api/competitions/${encodeURIComponent(token)}`);
  },
  registerScouter(token: string, name: string): Promise<{ scouter_cookie_id: string; scouter_name: string }> {
    return request(`/api/competitions/${encodeURIComponent(token)}/scouter`, {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },
  fetchScouterSelf(token: string): Promise<{ scouter_cookie_id: string; scouter_name: string } | null> {
    return fetch(`/api/competitions/${encodeURIComponent(token)}/scouter`, {
      credentials: "include"
    }).then(async (response) => {
      if (response.status === 204) {
        return null;
      }
      return parseResponse<{ scouter_cookie_id: string; scouter_name: string }>(response);
    });
  },
  saveDraft(token: string, draft: ScouterDraft): Promise<{ draft: ScouterDraft }> {
    return request(`/api/competitions/${encodeURIComponent(token)}/draft`, {
      method: "PUT",
      body: JSON.stringify(draft)
    });
  },
  loadDraft(token: string): Promise<{ draft: ScouterDraft | null }> {
    return fetch(`/api/competitions/${encodeURIComponent(token)}/draft`, {
      credentials: "include"
    }).then(async (response) => {
      if (response.status === 204) {
        return { draft: null };
      }
      return parseResponse<{ draft: ScouterDraft | null }>(response);
    });
  },
  existingScouts(token: string, matchNumber: string, teamNumber: string): Promise<{ count: number; scouter_names: string[] }> {
    const query = new URLSearchParams({ match_number: matchNumber, team_number: teamNumber });
    return request(`/api/competitions/${encodeURIComponent(token)}/existing-scouts?${query}`);
  },
  submitRecord(token: string, payload: { scouter_name: string; match_number: string; team_number: string; values: DraftValue }): Promise<{ record_id: string }> {
    return request(`/api/competitions/${encodeURIComponent(token)}/records`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

export function valueToFormString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "on" : "off";
  }
  return String(value);
}
