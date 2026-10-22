import Link from "next/link";
import { Badge } from "@/components/ui/core";
import { MATCH_STATUS, MATCH_TYPE } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  const s = MATCH_STATUS[status] ?? { label: status, className: "" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

export function TypeBadge({ type, counts }: { type: string; counts?: boolean }) {
  if (type === "OFICIAL") return null;
  const t = MATCH_TYPE[type];
  const cls =
    type === "AMISTOSO"
      ? "bg-zinc-100 text-zinc-700 ring-zinc-300"
      : type === "ELIMINATORIA"
        ? "bg-amber-100 text-amber-900 ring-amber-300"
        : "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300";
  return (
    <Badge className={cls}>
      {t?.short ?? type}
      {type === "INTERLIGA" && (counts ? " · cuenta" : " · no cuenta")}
    </Badge>
  );
}

interface ResultLike {
  resultType: string;
  homeGoals: number;
  awayGoals: number;
  homeShootout: number | null;
  awayShootout: number | null;
  winnerTeamId: string | null;
}

/** Marcador legible: "2 - 2 (pen. 4-3)" */
export function ScoreText({ result, homeTeamId }: { result: ResultLike | null; homeTeamId: string }) {
  if (!result) return <span className="text-zinc-400">—</span>;
  const pen =
    result.resultType === "DESEMPATE"
      ? result.homeShootout != null
        ? ` (pen. ${result.homeShootout}-${result.awayShootout})`
        : ` (gana ${result.winnerTeamId === homeTeamId ? "local" : "visitante"} en desempate)`
      : result.resultType === "ADMINISTRATIVO"
        ? " (adm.)"
        : "";
  return (
    <span className="font-bold whitespace-nowrap tabular-nums">
      {result.homeGoals} - {result.awayGoals}
      <span className="text-xs font-medium text-zinc-500">{pen}</span>
    </span>
  );
}

export function TeamLink({ id, name, winner }: { id: string; name: string; winner?: boolean }) {
  return (
    <Link href={`/equipos/${id}`} className={`hover:text-brand-700 hover:underline ${winner ? "font-extrabold" : "font-semibold"}`}>
      {name}
    </Link>
  );
}
