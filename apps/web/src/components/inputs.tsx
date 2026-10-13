import { useId, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="error" role="alert">{error}</small>}
    </div>
  );
}

/** Integer input shown with thousand separators; `null` when empty. */
export function NumberInput({
  id,
  value,
  onChange,
  prefix,
  maxDigits = 12,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  maxDigits?: number;
}) {
  const { lang } = useI18n();
  const shown = value === null ? '' : new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-ID').format(value);
  return (
    <div className="number-input">
      {prefix && <span className="prefix">{prefix}</span>}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
          onChange(digits === '' ? null : Number(digits));
        }}
      />
    </div>
  );
}

export function Choice<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="field choice">
      <legend>{label}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={String(o.value)} className={value === o.value ? 'selected' : ''}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
