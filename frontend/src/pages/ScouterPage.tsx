import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { FieldRenderer } from "../components/Field";
import { defaultValueForField, type DraftValue, type FieldValue, type ScoringField, type ScoringProfile, type ScouterDraft } from "../lib/types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; profile: ScoringProfile; competitionName: string }
  | { status: "error"; message: string };

type NameState =
  | { status: "loading" }
  | { status: "needs_name" }
  | { status: "named"; name: string };

export function ScouterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("c") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [nameState, setNameState] = useState<NameState>({ status: "loading" });
  const [draft, setDraft] = useState<ScouterDraft>({ scouter_name: "", match_number: "", team_number: "", values: {} });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: "idle" | "submitting" | "submitted" | "error"; recordId?: string; error?: string }>({ status: "idle" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>("");

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
          competitionName: response.competition.name
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
    setSubmitState({ status: "idle" });
    setDraftSavedAt(null);
  };

  if (loadState.status === "idle" || loadState.status === "loading") {
    return (
      <main className="scouter-shell">
        <p className="status">Loading competition…</p>
      </main>
    );
  }

  if (loadState.status === "not_found") {
    return (
      <main className="scouter-shell">
        <p className="error">Competition not found. Check the QR code or URL.</p>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="scouter-shell">
        <p className="error">{loadState.message}</p>
      </main>
    );
  }

  if (nameState.status === "loading") {
    return (
      <main className="scouter-shell">
        <p className="status">Checking scouter cookie…</p>
      </main>
    );
  }

  if (nameState.status === "needs_name") {
    return (
      <main className="scouter-shell">
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
      <section className="scouter-card">
        <p className="eyebrow">Miniscout Scouter</p>
        <h1>{loadState.competitionName}</h1>
        <p className="intro">Hello <strong data-testid="scouter-name">{nameState.name}</strong>. Fill the fields below; your draft auto-saves.</p>
        <p className="muted">
          {savingDraft ? "Saving draft…" : draftSavedAt ? `Draft saved at ${new Date(draftSavedAt).toLocaleTimeString()}` : null}
        </p>
        <form onSubmit={handleSubmitRecord}>
          <div className="header-grid">
            <label className="scouter-field">
              <span className="label">Match number</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.match_number}
                onChange={(event) => setDraft((current) => ({ ...current, match_number: event.target.value }))}
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
