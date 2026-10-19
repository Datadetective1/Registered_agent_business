import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Form field primitives. They are plain components (no hooks) so they work in
 * both server and client components. Pass `error` to show a message and set
 * aria-invalid/aria-describedby.
 */

const control =
  "block w-full rounded-md border bg-surface px-3 text-base sm:text-[15px] text-ink placeholder:text-subtle shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-sand disabled:text-muted";

function fieldId(name: string) {
  return `f-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function Label({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger-fg">
      {message}
    </p>
  );
}

export function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-muted">
      {children}
    </p>
  );
}

type Common = { name: string; label: ReactNode; error?: string; hint?: ReactNode; optional?: boolean; className?: string };

export function TextField({ name, label, error, hint, optional, className, ...props }: Common & Omit<ComponentProps<"input">, "name">) {
  const id = props.id ?? fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, "h-11", error ? "border-danger-fg" : "border-line-strong")}
        {...props}
      />
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function TextAreaField({ name, label, error, hint, optional, className, ...props }: Common & Omit<ComponentProps<"textarea">, "name">) {
  const id = props.id ?? fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <textarea
        id={id}
        name={name}
        rows={props.rows ?? 4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, "py-2.5", error ? "border-danger-fg" : "border-line-strong")}
        {...props}
      />
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  optional,
  className,
  options,
  placeholder,
  ...props
}: Common &
  Omit<ComponentProps<"select">, "name"> & {
    options: ReadonlyArray<{ value: string; label: string }>;
    placeholder?: string;
  }) {
  const id = props.id ?? fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, "h-11 pr-8", error ? "border-danger-fg" : "border-line-strong")}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: Omit<Common, "optional"> & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = props.id ?? fieldId(name);
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="mt-0.5 size-5 shrink-0 rounded border-line-strong accent-[var(--brand-primary)]"
          {...props}
        />
        <label htmlFor={id} className="text-[15px] leading-snug text-ink">
          {label}
          {hint ? (
            <span id={`${id}-hint`} className="mt-1 block text-sm text-muted">
              {hint}
            </span>
          ) : null}
        </label>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function RadioGroup({
  name,
  legend,
  options,
  error,
  defaultValue,
  className,
}: {
  name: string;
  legend: ReactNode;
  options: ReadonlyArray<{ value: string; label: ReactNode; description?: ReactNode }>;
  error?: string;
  defaultValue?: string;
  className?: string;
}) {
  const id = fieldId(name);
  return (
    <fieldset className={className} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-info-bg/40"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="mt-1 size-4 shrink-0 accent-[var(--brand-primary)]"
            />
            <span className="text-[15px] leading-snug">
              <span className="font-medium text-ink">{o.label}</span>
              {o.description ? <span className="mt-0.5 block text-sm text-muted">{o.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

export function Fieldset({ legend, description, children, className }: { legend: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      <div>
        <legend className="font-serif text-xl font-semibold text-ink">{legend}</legend>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
