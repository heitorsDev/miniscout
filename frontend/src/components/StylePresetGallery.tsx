import type { StylePreset } from "../lib/stylePresets";

type StylePresetGalleryProps = {
  presets: StylePreset[];
  onSelect: (preset: StylePreset) => void;
};

/**
 * "Start from a preset" gallery for the admin Settings page (#26).
 *
 * Purely presentational: clicking a card hands the preset back to the
 * caller, which is responsible for replacing the live form state (see
 * AdminSettingsPage's applyPreset). There is no preview logic here — the
 * existing live-preview effect in AdminSettingsPage takes over as soon as
 * the form state changes, so selecting a preset renders through the exact
 * same path as any manual edit.
 */
export function StylePresetGallery({ presets, onSelect }: StylePresetGalleryProps) {
  return (
    <div className="style-preset-gallery" role="list">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="listitem"
          className="style-preset-card"
          data-testid={`style-preset-${preset.id}`}
          onClick={() => onSelect(preset)}
          style={{
            background: preset.profile.colors.surface,
            borderColor: preset.profile.colors.border,
            color: preset.profile.colors.text
          }}
        >
          <span className="style-preset-swatches" aria-hidden="true">
            <span className="style-preset-swatch" style={{ background: preset.profile.colors.background }} />
            <span className="style-preset-swatch" style={{ background: preset.profile.colors.accent }} />
            <span className="style-preset-swatch" style={{ background: preset.profile.colors.surface }} />
          </span>
          <span className="style-preset-label">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
