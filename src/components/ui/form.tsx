"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";
import type { ActionResult } from "@/server/action";
import { Button, inputClass } from "./core";

type FormCtx = { errors: Record<string, string>; pending: boolean };
const Ctx = createContext<FormCtx>({ errors: {}, pending: false });
export const useFormCtx = () => useContext(Ctx);

export type ServerAction<T = unknown> = (fd: FormData) => Promise<ActionResult<T>>;

/**
 * Formulario conectado a una acción del servidor:
 * - muestra errores por campo y mensajes de éxito/error,
 * - si el servidor devuelve advertencias que requieren confirmación,
 *   las muestra y permite reenviar con confirm=1.
 */
export function ActionForm<T>({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess = false,
  refresh = true,
  successMessage,
  confirmLabel = "Confirmar y guardar",
  id,
}: {
  action: ServerAction<T>;
  children: ReactNode;
  className?: string;
  onSuccess?: (r: Extract<ActionResult<T>, { ok: true }>) => void;
  resetOnSuccess?: boolean;
  refresh?: boolean;
  successMessage?: string;
  confirmLabel?: string;
  id?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const submit = (confirm: boolean) => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    if (confirm) fd.set("confirm", "1");
    start(async () => {
      const r = await action(fd);
      if (r.ok) {
        setErrors({});
        setWarnings(null);
        setErrorMsg(null);
        toast.success(r.message ?? successMessage ?? "Cambios guardados.");
        if (r.warnings?.length) toast.warning(r.warnings.join(" "));
        if (resetOnSuccess) form.reset();
        onSuccess?.(r);
        if (refresh) router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        setErrorMsg(r.error);
        if (r.needsConfirmation) setWarnings(r.warnings ?? []);
        else {
          setWarnings(null);
          toast.error(r.error);
        }
      }
    });
  };

  return (
    <Ctx.Provider value={{ errors, pending }}>
      <form
        id={id}
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        aria-busy={pending}
      >
        {children}
        {errorMsg && !warnings && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
            {errorMsg}
          </p>
        )}
        {warnings && (
          <div role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
            <p className="font-semibold">{errorMsg}</p>
            {warnings.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => submit(true)} disabled={pending}>
                {pending ? "Guardando…" : confirmLabel}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWarnings(null)}>
                Revisar
              </Button>
            </div>
          </div>
        )}
      </form>
    </Ctx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const { errors } = useFormCtx();
  if (!errors[name]) return null;
  return <p className="mt-1 text-xs font-medium text-red-700">{errors[name]}</p>;
}

function useFieldId(name: string, id?: string) {
  const auto = useId();
  return id ?? `${name}-${auto}`;
}

type FieldProps = { label?: ReactNode; hint?: ReactNode; name: string; className?: string };

export function TextField({ label, hint, name, className, id, ...rest }: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const fid = useFieldId(name, id);
  const { errors } = useFormCtx();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fid} className="mb-1 block text-xs font-semibold text-zinc-700">
          {label}
          {rest.required && <span className="text-brand-700"> *</span>}
          {hint && <span className="ml-1 font-normal text-zinc-500">{hint}</span>}
        </label>
      )}
      <input
        id={fid}
        name={name}
        aria-invalid={!!errors[name]}
        className={clsx(inputClass, errors[name] && "ring-red-500")}
        {...rest}
      />
      <FieldError name={name} />
    </div>
  );
}

export function TextArea({ label, hint, name, className, id, ...rest }: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const fid = useFieldId(name, id);
  const { errors } = useFormCtx();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fid} className="mb-1 block text-xs font-semibold text-zinc-700">
          {label}
          {rest.required && <span className="text-brand-700"> *</span>}
          {hint && <span className="ml-1 font-normal text-zinc-500">{hint}</span>}
        </label>
      )}
      <textarea id={fid} name={name} rows={2} className={clsx(inputClass, errors[name] && "ring-red-500")} {...rest} />
      <FieldError name={name} />
    </div>
  );
}

export function SelectField({
  label,
  hint,
  name,
  className,
  id,
  options,
  placeholder,
  ...rest
}: FieldProps &
  Omit<ComponentProps<"select">, "name"> & {
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
  }) {
  const fid = useFieldId(name, id);
  const { errors } = useFormCtx();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fid} className="mb-1 block text-xs font-semibold text-zinc-700">
          {label}
          {rest.required && <span className="text-brand-700"> *</span>}
          {hint && <span className="ml-1 font-normal text-zinc-500">{hint}</span>}
        </label>
      )}
      <select id={fid} name={name} className={clsx(inputClass, "pr-8", errors[name] && "ring-red-500")} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError name={name} />
    </div>
  );
}

export function CheckboxField({ label, hint, name, className, id, ...rest }: FieldProps & Omit<ComponentProps<"input">, "name" | "type">) {
  const fid = useFieldId(name, id);
  return (
    <div className={clsx("flex items-start gap-2", className)}>
      <input
        id={fid}
        type="checkbox"
        name={name}
        value="1"
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-700 accent-brand-700 focus:ring-brand-600"
        {...rest}
      />
      <label htmlFor={fid} className="text-sm text-zinc-800">
        {label}
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </label>
      <FieldError name={name} />
    </div>
  );
}

export function SubmitButton({ children, variant, size, className }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "dark"; size?: "sm" | "md"; className?: string }) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className}>
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" />
        </svg>
      )}
      {pending ? "Procesando…" : children}
    </Button>
  );
}

// ───────── Diálogo modal ─────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={clsx(
        "m-auto max-h-[90vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div>
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Botón que abre un modal con contenido (normalmente un ActionForm). */
export function ModalButton({
  label,
  title,
  description,
  children,
  variant = "primary",
  size = "md",
  wide,
  icon,
}: {
  label: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: (close: () => void) => ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md";
  wide?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} wide={wide}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

/** Confirmación para operaciones destructivas, con motivo opcional u obligatorio. */
export function ConfirmAction({
  action,
  hidden,
  label,
  title,
  description,
  confirmLabel = "Confirmar",
  reason = "none",
  variant = "danger",
  size = "sm",
  successMessage,
  onDone,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  label: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  reason?: "none" | "optional" | "required";
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md";
  successMessage?: string;
  onDone?: () => void;
}) {
  return (
    <ModalButton label={label} title={title} variant={variant} size={size}>
      {(close) => (
        <ActionForm
          action={action}
          successMessage={successMessage}
          onSuccess={() => {
            close();
            onDone?.();
          }}
        >
          {description && <div className="mb-4 text-sm text-zinc-700">{description}</div>}
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {reason !== "none" && (
            <TextArea name="reason" label="Motivo" required={reason === "required"} placeholder="Describe brevemente el motivo" />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton variant={variant === "danger" ? "dark" : "primary"}>{confirmLabel}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
