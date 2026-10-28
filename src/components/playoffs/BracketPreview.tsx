import { describeSource, type BracketFormat } from "@/domain/bracket";
import { layoutBracket } from "@/domain/bracket-layout";

export function BracketPreview({ format }: { format: BracketFormat }) {
  const layout = layoutBracket(format);
  const names = Object.fromEntries(format.stages.map((stage) => [stage.code, stage.name]));
  if (!format.stages.length) return <p className="p-5 text-sm text-slate-600">Configura las etapas y sus cruces para ver el cuadro.</p>;
  return (
    <div>
      <p className="border-b border-slate-200 px-5 py-3 text-xs leading-relaxed text-slate-600">
        Las posiciones se asignan al cerrar la fase regular. Cada línea conecta un cruce con su siguiente etapa; las líneas punteadas indican el pase del perdedor. Desliza horizontalmente si el cuadro no cabe en pantalla.
      </p>
      <div role="region" aria-label="Vista previa de los cruces por etapa" tabIndex={0} className="scroll-thin overflow-x-auto rounded-b-xl bg-slate-50 p-5 focus-visible:outline-2 focus-visible:outline-blue-700">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 text-slate-400" width={layout.width} height={layout.height}>
            {layout.edges.map((edge) => <path key={`${edge.to}-${edge.side}`} d={edge.path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edge.kind === "loser" ? "4 4" : undefined} />)}
          </svg>
          {format.stages.map((stage, index) => (
            <section key={`${stage.code}-${index}`} aria-label={stage.name}>
              <h3 className="absolute border-b-2 border-orange-400 pb-2 text-sm font-bold text-[#102d50]" style={{ left: index * (layout.cardWidth + layout.columnGap), width: layout.cardWidth }}>{stage.name}</h3>
              <ol>
                {layout.nodes.filter((node) => node.column === index).map((node) => (
                  <li key={node.slot} className="absolute overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm" style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
                    <p className="border-b border-slate-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-900">Cruce {node.slot}</p>
                    <div className="divide-y divide-slate-100 px-3">
                      {[node.home, node.away].map((source, side) => (
                        <p key={side} className="flex h-[54px] items-center text-[13px] leading-snug text-slate-800" title={describeSource(source, names)}>
                          <span className="line-clamp-3">{describeSource(source, names)}</span>
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
