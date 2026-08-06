import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { applyStyleProfile } from "../lib/applyStyleProfile";
import { useStyleProfile } from "../lib/StyleProfileContext";
import type { StyleProfile } from "../lib/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function AdminSettingsPage() {
  const { setProfile: publishProfile } = useStyleProfile();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [form, setForm] = useState<StyleProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.getStyleProfile()
      .then((loaded) => {
        if (cancelled) return;
        setForm(loaded);
        setLoadState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load style profile"
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live preview: every form-state change re-runs the shared mapping
  // function and writes straight onto document.documentElement. There is
  // no separate "preview mode" — the form IS the preview.
  useEffect(() => {
    if (!form) {
      return;
    }
    applyStyleProfile(form);
  }, [form]);

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    setSaveStatus("");
    setSaveError("");
    try {
      const saved = await api.updateStyleProfile(form);
      setForm(saved);
      publishProfile(saved);
      setSaveStatus("Style profile saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loadState.status === "loading" || !form) {
    return (
      <section className="profile-card" aria-labelledby="settings-title">
        <p className="eyebrow">Miniscout Admin</p>
        <h1 id="settings-title">Settings</h1>
        <p className="status">Loading style profile…</p>
      </section>
    );
  }

  if (loadState.status === "error") {
    return (
      <section className="profile-card" aria-labelledby="settings-title">
        <p className="eyebrow">Miniscout Admin</p>
        <h1 id="settings-title">Settings</h1>
        <p role="alert" className="error">{loadState.message}</p>
      </section>
    );
  }

  return (
    <section className="profile-card" aria-labelledby="settings-title">
      <p className="eyebrow">Miniscout Admin</p>
      <h1 id="settings-title">Settings</h1>
      <p className="intro">
        Edit the active visual identity. Every change previews live below and across the app immediately;
        nothing is persisted until you press Save.
      </p>

      <div className="control-group">
        <label htmlFor="style-profile-name">Profile name</label>
        <input
          id="style-profile-name"
          type="text"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </div>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>

      {saveStatus && <p role="status" className="status">{saveStatus}</p>}
      {saveError && <p role="alert" className="error">{saveError}</p>}
    </section>
  );
}
