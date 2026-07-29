import type { FieldValue, ScoringField } from "../lib/types";

type FieldProps<F extends ScoringField> = {
  field: F;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
};

export function CounterField({ field, value, onChange }: FieldProps<Extract<ScoringField, { type: "counter" }>>) {
  const numericValue = typeof value === "number" ? value : 0;
  return (
    <div className="scouter-field counter" data-field-key={field.key} data-field-type="counter">
      <span className="label">{field.label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Decrease ${field.label}`}
          onClick={() => onChange(Math.max(0, numericValue - 1))}
        >
          −
        </button>
        <span aria-live="polite" className="value">{numericValue}</span>
        <button
          type="button"
          aria-label={`Increase ${field.label}`}
          onClick={() => onChange(numericValue + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function NumberField({ field, value, onChange }: FieldProps<Extract<ScoringField, { type: "number" }>>) {
  const numericValue = typeof value === "number" ? value : 0;
  return (
    <label className="scouter-field number" data-field-key={field.key} data-field-type="number">
      <span className="label">{field.label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={numericValue}
        onChange={(event) => {
          const next = event.target.value === "" ? 0 : Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </label>
  );
}

export function BooleanField({ field, value, onChange }: FieldProps<Extract<ScoringField, { type: "boolean" }>>) {
  const checked = value === true;
  return (
    <label className="scouter-field boolean" data-field-key={field.key} data-field-type="boolean">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="label">{field.label}</span>
    </label>
  );
}

export function EnumField({ field, value, onChange }: FieldProps<Extract<ScoringField, { type: "enum" }>>) {
  const options = Object.keys(field.points_per_option);
  const selected = typeof value === "string" ? value : options[0] ?? "";
  return (
    <fieldset className="scouter-field enum" data-field-key={field.key} data-field-type="enum">
      <legend className="label">{field.label}</legend>
      {options.map((option) => (
        <label key={option} className="enum-option">
          <input
            type="radio"
            name={`field-${field.key}`}
            checked={selected === option}
            onChange={() => onChange(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function NoteField({ field, value, onChange }: FieldProps<Extract<ScoringField, { type: "note" }>>) {
  const text = typeof value === "string" ? value : "";
  return (
    <label className="scouter-field note" data-field-key={field.key} data-field-type="note">
      <span className="label">{field.label}</span>
      <textarea
        rows={3}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function FieldRenderer({ field, value, onChange }: FieldProps<ScoringField>) {
  switch (field.type) {
    case "counter":
      return <CounterField field={field} value={value} onChange={onChange} />;
    case "number":
      return <NumberField field={field} value={value} onChange={onChange} />;
    case "boolean":
      return <BooleanField field={field} value={value} onChange={onChange} />;
    case "enum":
      return <EnumField field={field} value={value} onChange={onChange} />;
    case "note":
      return <NoteField field={field} value={value} onChange={onChange} />;
    default:
      return null;
  }
}
