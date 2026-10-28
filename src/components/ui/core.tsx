import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cn };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#102d50] text-white hover:bg-[#1b4776] focus-visible:ring-blue-700 shadow-sm",
  secondary: "bg-white text-zinc-800 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 focus-visible:ring-blue-700",
  ghost: "text-zinc-700 hover:bg-zinc-100 focus-visible:ring-blue-700",
  danger: "bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 focus-visible:ring-red-500",
  dark: "bg-zinc-900 text-white hover:bg-black focus-visible:ring-zinc-500",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  // Las rutas /api (PDF, respaldos) no deben precargarse: generarían el documento en cada visita.
  const isApi = typeof props.href === "string" && props.href.startsWith("/api/");
  return <Link {...props} className={buttonClass(variant, size, className)} prefetch={isApi ? false : props.prefetch} />;
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={clsx("rounded-xl bg-white shadow-sm ring-1 ring-zinc-200", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Sección plegable: guarda formularios y detalles secundarios fuera de la vista principal. */
export function Collapsible({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={clsx("group rounded-xl bg-white shadow-sm ring-1 ring-zinc-200", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-bold text-zinc-900 select-none [&::-webkit-details-marker]:hidden">
        {title}
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-zinc-100">{children}</div>
    </details>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
            {breadcrumb.map((b, i) => (
              <span key={b.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={b.href} className="hover:text-brand-700 hover:underline">
                  {b.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-zinc-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset",
        className ?? "bg-zinc-100 text-zinc-700 ring-zinc-300",
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const tones = {
    default: "text-zinc-900",
    warn: "text-amber-600",
    danger: "text-brand-700",
    ok: "text-emerald-700",
  };
  const body = (
    <div className="h-full rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 transition hover:ring-brand-300">
      <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className={clsx("mt-1 text-2xl font-extrabold tabular-nums", tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-800" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3l3 5-3 3-3-3 3-5zM3.5 10l5-2M20.5 10l-5-2M8 20l1-5 3-1 3 1 1 5" />
        </svg>
      </div>
      <p className="font-semibold text-zinc-800">{title}</p>
      {description && <p className="max-w-md text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-red-50 text-red-900 ring-red-200",
    ok: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={clsx(title && "mt-1")}>{children}</div>}
    </div>
  );
}

// ───────── Tablas ─────────

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("scroll-thin overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TH({ children, className, ...rest }: ComponentProps<"th">) {
  return (
    <th
      className={clsx(
        "border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-bold tracking-wide whitespace-nowrap text-zinc-600 uppercase",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, ...rest }: ComponentProps<"td">) {
  return (
    <td className={clsx("border-b border-zinc-100 px-3 py-2 align-middle", className)} {...rest}>
      {children}
    </td>
  );
}

/** Encabezado de columna ordenable mediante parámetros de URL. */
export function SortTH({
  label,
  field,
  sort,
  dir,
  hrefFor,
  className,
}: {
  label: string;
  field: string;
  sort?: string;
  dir?: string;
  hrefFor: (sort: string, dir: string) => string;
  className?: string;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <TH className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={hrefFor(field, nextDir)} className="inline-flex items-center gap-1 hover:text-brand-700">
        {label}
        <span aria-hidden className={clsx("text-[10px]", active ? "text-brand-700" : "text-zinc-300")}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </TH>
  );
}

export function Pagination({
  page,
  pageCount,
  hrefFor,
  total,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  total: number;
}) {
  if (pageCount <= 1) return <p className="px-4 py-3 text-xs text-zinc-500">{total} registro(s)</p>;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-zinc-600" aria-label="Paginación">
      <span>
        Página {page} de {pageCount} · {total} registro(s)
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <LinkButton href={hrefFor(page - 1)} variant="secondary" size="sm">
            ← Anterior
          </LinkButton>
        ) : (
          <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")}>← Anterior</span>
        )}
        {page < pageCount ? (
          <LinkButton href={hrefFor(page + 1)} variant="secondary" size="sm">
            Siguiente →
          </LinkButton>
        ) : (
          <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")}>Siguiente →</span>
        )}
      </div>
    </nav>
  );
}

// ───────── Formularios (estáticos; para formularios GET de filtros) ─────────

export const inputClass =
  "block min-h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:bg-slate-100 disabled:text-slate-500";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-zinc-700">
      {children}
      {hint && <span className="ml-1 font-normal text-zinc-500">{hint}</span>}
    </label>
  );
}

/** Construye un href conservando parámetros existentes. */
export function withParams(base: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}
