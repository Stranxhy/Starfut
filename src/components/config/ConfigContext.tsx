import type { ReactNode } from "react";

export function ConfigContext({ title, context, description, children }: { title: string; context: string; description: string; children?: ReactNode }) {
  return <section className="bg-sport mb-5 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6" aria-label={title}>
    <p className="text-xs text-blue-100">{context}</p><h2 className="mt-1 text-xl font-bold break-words">{title}</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-blue-100">{description}</p>{children}
  </section>;
}
