import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { applyStyleProfile } from "../lib/applyStyleProfile";
import { useStyleProfile } from "../lib/StyleProfileContext";
import type { StyleProfile, StyleProfileColorKey } from "../lib/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

const COLOR_FIELDS: Array<{ key: StyleProfileColorKey; label: string }> = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "textMuted", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "accentContrast", label: "Accent contrast" },
  { key: "border", label: "Border" },
  { key: "danger", label: "Danger" },
  { key: "success", label: "Success" }
];

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

  const setColor = (key: StyleProfileColorKey, value: string) => {
    if (!form) {
      return;
    }
    setForm({ ...form, colors: { ...form.colors, [key]: value } });
  };

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

      <section aria-labelledby="colors-title">
        <h2 id="colors-title">Colors</h2>
        <div className="color-field-grid">
          {COLOR_FIELDS.map(({ key, label }) => (
            <label key={key} className="color-field" htmlFor={`color-${key}`}>
              <span>{label}</span>
              <input
                id={`color-${key}`}
                type="color"
                value={form.colors[key]}
                onChange={(event) => setColor(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>

      {saveStatus && <p role="status" className="status">{saveStatus}</p>}
      {saveError && <p role="alert" className="error">{saveError}</p>}
    </section>
  );
}
