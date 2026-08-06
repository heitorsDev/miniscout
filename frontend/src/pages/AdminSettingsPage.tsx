import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { applyStyleProfile } from "../lib/applyStyleProfile";
import { useStyleProfile } from "../lib/StyleProfileContext";
import {
  STYLE_PROFILE_DENSITY_OPTIONS,
  STYLE_PROFILE_FONT_MONO_OPTIONS,
  STYLE_PROFILE_FONT_UI_OPTIONS,
  STYLE_PROFILE_RADIUS_OPTIONS,
  type StyleProfile,
  type StyleProfileColorKey,
  type StyleProfileFontMono,
  type StyleProfileFontUi,
  type StyleProfileShapeDensity,
  type StyleProfileShapeRadius
} from "../lib/types";

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

const FONT_UI_LABELS: Record<StyleProfileFontUi, string> = {
  inter: "Inter"
};

const FONT_MONO_LABELS: Record<StyleProfileFontMono, string> = {
  "jetbrains-mono": "JetBrains Mono"
};

const RADIUS_LABELS: Record<StyleProfileShapeRadius, string> = {
  sharp: "Sharp",
  rounded: "Rounded"
};

const DENSITY_LABELS: Record<StyleProfileShapeDensity, string> = {
  compact: "Compact",
  spacious: "Spacious"
};

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

      <section aria-labelledby="typography-title">
        <h2 id="typography-title">Typography</h2>
        <div className="control-group">
          <label htmlFor="font-ui">UI font</label>
          <select
            id="font-ui"
            value={form.typography.fontUi}
            onChange={(event) =>
              setForm({
                ...form,
                typography: { ...form.typography, fontUi: event.target.value as StyleProfileFontUi }
              })
            }
          >
            {STYLE_PROFILE_FONT_UI_OPTIONS.map((option) => (
              <option key={option} value={option}>{FONT_UI_LABELS[option]}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="font-mono">Mono/numeric font</label>
          <select
            id="font-mono"
            value={form.typography.fontMono}
            onChange={(event) =>
              setForm({
                ...form,
                typography: { ...form.typography, fontMono: event.target.value as StyleProfileFontMono }
              })
            }
          >
            {STYLE_PROFILE_FONT_MONO_OPTIONS.map((option) => (
              <option key={option} value={option}>{FONT_MONO_LABELS[option]}</option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby="shape-title">
        <h2 id="shape-title">Shape</h2>
        <div className="control-group">
          <label htmlFor="shape-radius">Corner radius</label>
          <select
            id="shape-radius"
            value={form.shape.radius}
            onChange={(event) =>
              setForm({ ...form, shape: { ...form.shape, radius: event.target.value as StyleProfileShapeRadius } })
            }
          >
            {STYLE_PROFILE_RADIUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{RADIUS_LABELS[option]}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="shape-density">Density</label>
          <select
            id="shape-density"
            value={form.shape.density}
            onChange={(event) =>
              setForm({ ...form, shape: { ...form.shape, density: event.target.value as StyleProfileShapeDensity } })
            }
          >
            {STYLE_PROFILE_DENSITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{DENSITY_LABELS[option]}</option>
            ))}
          </select>
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
