import { useId, useState } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldShellProps {
  controlId: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ controlId, label, hint, error, children, className = "" }: FieldShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <label htmlFor={controlId} className="text-xs font-medium tracking-wide text-sky/80">{label}</label>
        {hint && <span onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
          <button type="button" aria-label={`Ayuda: ${label}`} aria-expanded={open} aria-controls={`${controlId}-help`} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={()=>setOpen(true)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}} className="inline-grid h-5 w-5 place-items-center rounded-full border border-sky/40 text-xs font-semibold text-sky/80 focus-visible:outline-cyan-glow">i</button>
          <span id={`${controlId}-help`} role="tooltip" hidden={!open} className="absolute top-5 left-0 z-30 max-w-full rounded-md border border-line bg-hull px-3 py-2 text-xs leading-relaxed text-sky shadow-lg">{hint}</span>
        </span>}
      </div>
      {children}
      {error ? (
        <span className="text-xs text-rose">{error}</span>
      ) : null}
    </div>
  );
}

export const CONTROL_CLASS =
  "w-full rounded-lg border border-line bg-hull/70 px-3 py-2 text-sm text-sky/90 placeholder:text-sky/30 transition-colors focus:border-cyan-glow/50 focus:ring-1 focus:ring-cyan-glow/40 focus:outline-none disabled:opacity-50";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export function TextField({ label, hint, error, containerClassName, className = "", ...rest }: TextFieldProps) {
  const generated = useId(); const id = rest.id ?? generated;
  return (
    <FieldShell controlId={id} label={label} hint={hint} error={error} className={containerClassName}>
      <input {...rest} id={id} aria-describedby={hint ? `${id}-help` : rest['aria-describedby']} className={`${CONTROL_CLASS} ${className}`} />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, className = "", ...rest }: TextAreaFieldProps) {
  const generated = useId(); const id = rest.id ?? generated;
  return (
    <FieldShell controlId={id} label={label} hint={hint} error={error}>
      <textarea {...rest} id={id} aria-describedby={hint ? `${id}-help` : rest['aria-describedby']} className={`${CONTROL_CLASS} font-mono text-xs leading-relaxed ${className}`} />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
}

export function SelectField({ label, options, hint, error, className = "", ...rest }: SelectFieldProps) {
  const generated = useId(); const id = rest.id ?? generated;
  return (
    <FieldShell controlId={id} label={label} hint={hint} error={error}>
      <select {...rest} id={id} aria-describedby={hint ? `${id}-help` : rest['aria-describedby']} className={`${CONTROL_CLASS} ${className}`}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-hull text-sky">
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-sky/80">{label}</p>
        {hint ? <p className="text-xs text-sky/40">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-glow/60 focus-visible:outline-none ${
          checked ? "border-cyan-glow/50 bg-cyan-glow/30" : "border-line bg-hull"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-transform duration-200 ${
            checked ? "translate-x-5.5 bg-cyan-glow" : "translate-x-0.5 bg-sky/40"
          }`}
          style={{ height: "18px", width: "18px" }}
        />
      </button>
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-xs font-medium tracking-wide text-sky/60">{label}</span> : null}
      <div className="flex rounded-lg border border-line bg-hull/70 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-cyan-glow/60 focus-visible:outline-none ${
                active
                  ? "bg-cyan-glow/15 text-cyan-glow shadow-[0_0_16px_rgba(0,237,255,0.25)]"
                  : "text-sky/50 hover:text-sky/80"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
