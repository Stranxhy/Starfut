import { Check } from "lucide-react";

export function PlayoffProgress({ closed, complete = false }: { closed: boolean; complete?: boolean }) {
  const current = complete ? 3 : closed ? 2 : 1;
  const steps = [
    { label: "Preparar y revisar", detail: "Equipos, jornadas y clasificación" },
    { label: "Disputar eliminatorias", detail: "Generar cruces y registrar resultados" },
    { label: "Definir campeón", detail: "Resultado de la final" },
  ];
  return (
    <ol aria-label="Progreso de las eliminatorias" className="mb-5 grid gap-3 rounded-xl border border-slate-300 bg-white p-4 sm:grid-cols-3">
      {steps.map((step, index) => {
        const active = current === index + 1;
        const done = current > index + 1 || complete;
        return <li key={step.label} aria-current={active ? "step" : undefined} className="flex items-start gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-emerald-100 text-emerald-800" : active ? "bg-[#102d50] text-white ring-2 ring-orange-300 ring-offset-2" : "bg-slate-100 text-slate-500"}`}>
            {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
            <span className="sr-only">{done ? "Completado" : active ? "Paso actual" : "Pendiente"}</span>
          </span>
          <div><p className={`text-sm font-semibold ${active || done ? "text-slate-900" : "text-slate-500"}`}>{step.label}</p><p className="mt-0.5 text-xs text-slate-600">{step.detail}</p></div>
        </li>;
      })}
    </ol>
  );
}
