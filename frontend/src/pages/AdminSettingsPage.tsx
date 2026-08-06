import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { applyStyleProfile } from "../lib/applyStyleProfile";
import { useStyleProfile } from "../lib/StyleProfileContext";
import { StylePresetGallery } from "../components/StylePresetGallery";
import { stylePresets, type StylePreset } from "../lib/stylePresets";
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

  const setDarkColor = (key: StyleProfileColorKey, value: string) => {
    if (!form) {
      return;
    }
    setForm({ ...form, colors: { ...form.colors, dark: { ...form.colors.dark, [key]: value } } });
  };

  const toggleDarkVariant = (enabled: boolean) => {
    if (!form) {
      return;
    }
    if (!enabled) {
      const { dark: _dark, ...rest } = form.colors;
      setForm({ ...form, colors: rest });
      return;
    }
    // Seed the dark variant from the current light colors so every field
    // starts with a sensible, visible value.
    const { dark: _dark, ...lightColors } = form.colors;
    setForm({ ...form, colors: { ...form.colors, dark: { ...lightColors } } });
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !form) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = typeof reader.result === "string" ? reader.result : null;
      setForm((current) => (current ? { ...current, logo: { ...current.logo, dataUri } } : current));
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    if (!form) {
      return;
    }
    setForm({ ...form, logo: { ...form.logo, dataUri: null } });
  };

  // Reuses the exact same form-state-set that every manual edit above goes
  // through, so the existing live-preview effect picks it up with no
  // separate preview path. structuredClone guards against later in-place
  // edits on the form ever reaching back into the bundled preset object.
  const applyPreset = (preset: StylePreset) => {
    setForm(structuredClone(preset.profile));
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

      <section aria-labelledby="presets-title">
        <h2 id="presets-title">Start from a preset</h2>
        <p className="intro">
          Selecting a preset replaces every field below with its full profile and previews immediately.
          Presets are starting templates only — nothing is saved until you press Save.
        </p>
        <StylePresetGallery presets={stylePresets} onSelect={applyPreset} />
      </section>

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

      <section aria-labelledby="logo-title">
        <h2 id="logo-title">Logo &amp; team name</h2>
        <div className="control-group">
          <label htmlFor="team-name">Team name</label>
          <input
            id="team-name"
            type="text"
            value={form.logo.teamName}
            onChange={(event) => setForm({ ...form, logo: { ...form.logo, teamName: event.target.value } })}
          />
        </div>
        <div className="control-group">
          <label htmlFor="logo-file">Logo image</label>
          <input id="logo-file" type="file" accept="image/*" onChange={handleLogoFileChange} />
        </div>
        {form.logo.dataUri && (
          <div className="logo-preview">
            <img src={form.logo.dataUri} alt="Logo preview" data-testid="logo-preview-image" />
            <button type="button" onClick={clearLogo}>Clear logo</button>
          </div>
        )}
      </section>

      <section aria-labelledby="dark-variant-title">
        <h2 id="dark-variant-title">Dark variant</h2>
        <label className="dark-variant-toggle" htmlFor="dark-variant-enabled">
          <input
            id="dark-variant-enabled"
            type="checkbox"
            checked={Boolean(form.colors.dark)}
            onChange={(event) => toggleDarkVariant(event.target.checked)}
          />
          <span>Configure a dark variant (applied automatically under `prefers-color-scheme: dark`)</span>
        </label>
        {form.colors.dark && (
          <div className="color-field-grid" data-testid="dark-color-grid">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="color-field" htmlFor={`dark-color-${key}`}>
                <span>{label}</span>
                <input
                  id={`dark-color-${key}`}
                  type="color"
                  value={form.colors.dark?.[key] ?? form.colors[key]}
                  onChange={(event) => setDarkColor(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>

      {saveStatus && <p role="status" className="status">{saveStatus}</p>}
      {saveError && <p role="alert" className="error">{saveError}</p>}
    </section>
  );
}
