import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { FieldRenderer } from "../components/Field";
import { useStyleProfile } from "../lib/StyleProfileContext";
import { defaultValueForField, type DraftValue, type FieldValue, type ScoringField, type ScoringProfile, type ScouterDraft } from "../lib/types";

/**
 * Renders the configured logo/team name (StyleProfile.logo), if any.
 * Mirrors the AdminLayout header (frontend/src/layouts/AdminLayout.tsx).
 * ScouterPage had no header before this; it's added once here and reused
 * across every render branch below.
 */
function ScouterHeader() {
  const { profile } = useStyleProfile();
  const logo = profile?.logo;
  if (!logo || (!logo.dataUri && !logo.teamName)) {
    return null;
  }
  return (
    <header className="brand-logo scouter-header" data-testid="scouter-brand-logo">
      {logo.dataUri && <img src={logo.dataUri} alt="" className="brand-logo-image" />}
      {logo.teamName && <span className="brand-team-name">{logo.teamName}</span>}
    </header>
  );
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; profile: ScoringProfile; competitionName: string; competitionId: string }
  | { status: "error"; message: string };

type NameState =
  | { status: "loading" }
  | { status: "needs_name" }
  | { status: "named"; name: string };

type MatchSnapshot = {
  current_match_number: number | null;
  updated_at: string | null;
};

type BroadcastState = {
  snapshot: MatchSnapshot;
  connection: "idle" | "open" | "closed";
};

const DEFAULT_COMPETITION_ID = "default";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

export function ScouterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("c") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [nameState, setNameState] = useState<NameState>({ status: "loading" });
  const [draft, setDraft] = useState<ScouterDraft>({ scouter_name: "", match_number: "", team_number: "", values: {} });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: "idle" | "submitting" | "submitted" | "error"; recordId?: string; error?: string }>({ status: "idle" });
  const [existingScouts, setExistingScouts] = useState<{ count: number; scouter_names: string[] } | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastState>({
    snapshot: { current_match_number: null, updated_at: null },
    connection: "idle"
  });
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastInput, setBroadcastInput] = useState("");
  const userEditedMatchRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>("");

  const broadcastCompetitionId = loadState.status === "ready" ? loadState.competitionId : DEFAULT_COMPETITION_ID;

  useEffect(() => {
    if (!token) {
      setLoadState({ status: "error", message: "Missing competition token in URL" });
      return;
    }
    let cancelled = false;
    setLoadState({ status: "loading" });
    api.lookupCompetition(token)
      .then((response) => {
        if (cancelled) return;
        setLoadState({
          status: "ready",
          profile: response.profile,
          competitionName: response.competition.name,
          competitionId: response.competition._id
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setLoadState({ status: "not_found" });
          return;
        }
        setLoadState({ status: "error", message: error instanceof Error ? error.message : "Could not load competition" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const id = broadcastCompetitionId;
    let cancelled = false;
    fetch(`/api/scouter/competition/${id}`)
      .then((response) => response.ok ? response.json() as Promise<{ current_match_number: number | null; updated_at?: string }> : null)
      .then((data) => {
        if (cancelled || !data) {
          return;
        }
        setBroadcast((current) => ({
          snapshot: {
            current_match_number: data.current_match_number,
            updated_at: data.updated_at ?? null
          },
          connection: current.connection
        }));
      })
      .catch(() => {
        // tolerate; SSE will sync state once connected
      });

    const source = new EventSource(`/api/scouter/competition/${id}/stream`);
    source.addEventListener("match-number", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as MatchSnapshot & { updated_at: string };
        setBroadcast((current) => ({
          snapshot: { current_match_number: payload.current_match_number, updated_at: payload.updated_at },
          connection: current.connection
        }));
      } catch {
        // ignore malformed events
      }
    });
    source.onopen = () => setBroadcast((current) => ({ ...current, connection: "open" }));
    source.onerror = () => setBroadcast((current) => ({ ...current, connection: "closed" }));

    return () => {
      cancelled = true;
      source.close();
    };
  }, [broadcastCompetitionId]);

  useEffect(() => {
    if (userEditedMatchRef.current) {
      return;
    }
    const value = broadcast.snapshot.current_match_number;
    if (value === null) {
      return;
    }
    setDraft((current) => {
      if (current.match_number.trim() !== "") {
        return current;
      }
      return { ...current, match_number: String(value) };
    });
  }, [broadcast.snapshot.current_match_number]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    api.fetchScouterSelf(token)
      .then((scouter) => {
        if (cancelled) return;
        if (scouter) {
          setNameState({ status: "named", name: scouter.scouter_name });
          setDraft((current) => ({ ...current, scouter_name: scouter.scouter_name }));
        } else {
          setNameState({ status: "needs_name" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setNameState({ status: "needs_name" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || nameState.status !== "named") {
      return;
    }
    let cancelled = false;
    api.loadDraft(token)
      .then((response) => {
        if (cancelled) return;
        if (response.draft) {
          setDraft({
            scouter_name: response.draft.scouter_name,
            match_number: response.draft.match_number,
            team_number: response.draft.team_number,
            values: response.draft.values
          });
          setDraftSavedAt(response.draft.updated_at ?? null);
          if (response.draft.scouter_name) {
            setNameState({ status: "named", name: response.draft.scouter_name });
          }
          if (response.draft.match_number) {
            userEditedMatchRef.current = true;
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, nameState.status]);

  const fieldList = useMemo<ScoringField[]>(() => {
    if (loadState.status !== "ready") {
      return [];
    }
    return loadState.profile.fields;
  }, [loadState]);

  const updateField = useCallback((key: string, value: FieldValue) => {
    setDraft((current) => {
      const nextValues: DraftValue = { ...current.values, [key]: value };
      return { ...current, values: nextValues };
    });
  }, []);

  const scheduleDraftSave = useCallback((next: ScouterDraft) => {
    if (nameState.status !== "named") {
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      setSavingDraft(true);
      api.saveDraft(token, next)
        .then((response) => {
          setDraftSavedAt(response.draft.updated_at ?? null);
          lastSavedSnapshot.current = JSON.stringify({
            scouter_name: next.scouter_name,
            match_number: next.match_number,
            team_number: next.team_number,
            values: next.values
          });
        })
        .catch(() => undefined)
        .finally(() => setSavingDraft(false));
    }, 400);
  }, [token, nameState.status]);

  useEffect(() => {
    if (loadState.status !== "ready") return;
    const snapshot = JSON.stringify({
      scouter_name: draft.scouter_name,
      match_number: draft.match_number,
      team_number: draft.team_number,
      values: draft.values
    });
    if (snapshot === lastSavedSnapshot.current) {
      return;
    }
    scheduleDraftSave({
      scouter_name: draft.scouter_name,
      match_number: draft.match_number,
      team_number: draft.team_number,
      values: draft.values
    });
  }, [draft, loadState, scheduleDraftSave]);

  useEffect(() => {
    if (!token || !draft.match_number.trim() || !draft.team_number.trim()) {
      setExistingScouts(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.existingScouts(token, draft.match_number.trim(), draft.team_number.trim())
        .then((result) => { if (!cancelled) setExistingScouts(result); })
        .catch(() => { if (!cancelled) setExistingScouts(null); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, draft.match_number, draft.team_number]);

  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const candidate = String(formData.get("name") ?? "").trim();
    if (!candidate) {
      return;
    }
    setNameState({ status: "loading" });
    api.registerScouter(token, candidate)
      .then((registration) => {
        setNameState({ status: "named", name: registration.scouter_name });
        setDraft((current) => ({ ...current, scouter_name: registration.scouter_name }));
      })
      .catch((error: unknown) => {
        setNameState({ status: "needs_name" });
        setSubmitState({ status: "error", error: error instanceof Error ? error.message : "Could not register" });
      });
  };

  const handleSubmitRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.scouter_name.trim() || !draft.match_number.trim() || !draft.team_number.trim()) {
      return;
    }
    setSubmitState({ status: "submitting" });
    api.submitRecord(token, {
      scouter_name: draft.scouter_name,
      match_number: draft.match_number,
      team_number: draft.team_number,
      values: draft.values
    })
      .then((response) => {
        setSubmitState({ status: "submitted", recordId: response.record_id });
      })
      .catch((error: unknown) => {
        setSubmitState({ status: "error", error: error instanceof Error ? error.message : "Submission failed" });
      });
  };

  const handleStartNext = () => {
    if (!token || loadState.status !== "ready") {
      return;
    }
    const emptyValues: DraftValue = {};
    for (const field of loadState.profile.fields) {
      emptyValues[field.key] = defaultValueForField(field);
    }
    const newDraft: ScouterDraft = {
      scouter_name: nameState.status === "named" ? nameState.name : draft.scouter_name,
      match_number: "",
      team_number: "",
      values: emptyValues
    };
    setDraft(newDraft);
    userEditedMatchRef.current = false;
    setSubmitState({ status: "idle" });
    setDraftSavedAt(null);
  };

  const handleBroadcast = async () => {
    const trimmed = broadcastInput.trim();
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value <= 0) {
      setBroadcastError("Enter a positive integer match number");
      setBroadcastStatus("");
      return;
    }
    setBroadcastError("");
    setBroadcastStatus("");
    try {
      const response = await fetch(`/api/scouter/competition/${broadcastCompetitionId}/match-number`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiError = body as { error?: string; errors?: { path: string; message: string }[] };
        const details = apiError.errors?.map(({ path, message }) => `${path}: ${message}`).join("; ");
        throw new Error(details || apiError.error || `Broadcast failed (${response.status})`);
      }
      setBroadcastStatus(`Broadcast match ${value}`);
      setBroadcastInput(String(value));
    } catch (broadcastError) {
      setBroadcastError(broadcastError instanceof Error ? broadcastError.message : "Broadcast failed");
    }
  };

  if (!token) {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <section className="scouter-card" aria-labelledby="scouter-title">
          <p className="eyebrow">Miniscout Scouter</p>
          <h1 id="scouter-title">Scout Match</h1>
          <p className="intro">
            Current broadcast shows the suggested match for every scouter. Submit a value to override
            the broadcast for everyone.
          </p>

          <div className="broadcast-pill" data-testid="current-match-banner">
            <span className="broadcast-label">Current match</span>
            <strong data-testid="current-match-number" className="broadcast-value">
              {broadcast.snapshot.current_match_number ?? "—"}
            </strong>
            <span className="broadcast-time" data-testid="current-match-time">
              {formatTimestamp(broadcast.snapshot.updated_at)}
            </span>
          </div>

          <p className="connection-state" data-testid="sse-status">
            Stream: <span data-testid="sse-state">{broadcast.connection === "open" ? "live" : broadcast.connection === "closed" ? "disconnected" : "connecting"}</span>
          </p>

          <div className="control-group">
            <label htmlFor="match-input">Set current match number</label>
            <input
              id="match-input"
              data-testid="match-input"
              type="number"
              min={1}
              step={1}
              value={broadcastInput}
              onChange={(event) => setBroadcastInput(event.target.value)}
              placeholder={broadcast.snapshot.current_match_number !== null ? String(broadcast.snapshot.current_match_number) : ""}
            />
          </div>

          <button type="button" data-testid="broadcast-button" onClick={handleBroadcast}>
            Broadcast match number
          </button>

          {broadcastStatus && <p role="status" className="status">{broadcastStatus}</p>}
          {broadcastError && <p role="alert" className="error">{broadcastError}</p>}
        </section>
      </main>
    );
  }

  if (loadState.status === "idle" || loadState.status === "loading") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <p className="status">Loading competition…</p>
      </main>
    );
  }

  if (loadState.status === "not_found") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <p className="error">Competition not found. Check the QR code or URL.</p>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <p className="error">{loadState.message}</p>
      </main>
    );
  }

  if (nameState.status === "loading") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <p className="status">Checking scouter cookie…</p>
      </main>
    );
  }

  if (nameState.status === "needs_name") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <section className="name-card">
          <p className="eyebrow">Miniscout Scouter</p>
          <h1>{loadState.competitionName}</h1>
          <p className="intro">Enter your display name once. Subsequent reloads will remember you for 7 days.</p>
          <form onSubmit={handleNameSubmit}>
            <label htmlFor="scouter-name">Display name</label>
            <input id="scouter-name" name="name" autoFocus required maxLength={60} />
            <button type="submit">Continue</button>
            {submitState.error && <p role="alert" className="error">{submitState.error}</p>}
          </form>
        </section>
      </main>
    );
  }

  if (submitState.status === "submitted") {
    return (
      <main className="scouter-shell">
      <ScouterHeader />
        <section className="confirmation-card">
          <p className="eyebrow">Miniscout Scouter</p>
          <h1>Record submitted</h1>
          <p>Thanks, {nameState.name}. Match {draft.match_number} / Team {draft.team_number} is recorded.</p>
          <p className="muted">Record id: {submitState.recordId}</p>
          <button type="button" onClick={handleStartNext}>Start next record</button>
        </section>
      </main>
    );
  }

  return (
    <main className="scouter-shell">
      <ScouterHeader />
      <section className="scouter-card">
        <p className="eyebrow">Miniscout Scouter</p>
        <h1>{loadState.competitionName}</h1>
        <p className="intro">Hello <strong data-testid="scouter-name">{nameState.name}</strong>. Fill the fields below; your draft auto-saves.</p>
        <p className="muted">
          {savingDraft ? "Saving draft…" : draftSavedAt ? `Draft saved at ${new Date(draftSavedAt).toLocaleTimeString()}` : null}
        </p>

        <div className="broadcast-pill" data-testid="current-match-banner">
          <span className="broadcast-label">Current match</span>
          <strong data-testid="current-match-number" className="broadcast-value">
            {broadcast.snapshot.current_match_number ?? "—"}
          </strong>
          <span className="broadcast-time" data-testid="current-match-time">
            {formatTimestamp(broadcast.snapshot.updated_at)}
          </span>
        </div>

        <p className="connection-state" data-testid="sse-status">
          Stream: <span data-testid="sse-state">{broadcast.connection === "open" ? "live" : broadcast.connection === "closed" ? "disconnected" : "connecting"}</span>
        </p>

        <form onSubmit={handleSubmitRecord}>
          <div className="header-grid">
            <label className="scouter-field">
              <span className="label">Match number</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.match_number}
                onChange={(event) => {
                  userEditedMatchRef.current = true;
                  setDraft((current) => ({ ...current, match_number: event.target.value }));
                }}
                required
              />
            </label>
            <label className="scouter-field">
              <span className="label">Team number</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.team_number}
                onChange={(event) => setDraft((current) => ({ ...current, team_number: event.target.value }))}
                required
              />
            </label>
          </div>
          {existingScouts && existingScouts.count > 0 && <p role="status" data-testid="existing-scouts-hint">
            Already scouted {existingScouts.count} {existingScouts.count === 1 ? "time" : "times"} by {existingScouts.scouter_names.join(", ")}. You can still submit.
          </p>}
          <div className="field-grid">
            {fieldList.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft.values[field.key] ?? defaultValueForField(field)}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}
          </div>
          <button type="submit" disabled={submitState.status === "submitting"}>
            {submitState.status === "submitting" ? "Submitting…" : "Submit record"}
          </button>
          {submitState.error && <p role="alert" className="error">{submitState.error}</p>}
        </form>
      </section>
    </main>
  );
}