import { LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getSeasonId } from "@/server/season";
import { logoutAction } from "@/server/actions/auth";
import { Suspense } from "react";
import { SectionContext } from "@/components/layout/SectionContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { SeasonSwitcher } from "@/components/layout/SeasonSwitcher";
import { ROLE } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const seasonId = await getSeasonId();
  const [seasons, current] = await Promise.all([
    prisma.season.findMany({ orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }], select: { id: true, name: true, isCurrent: true } }),
    seasonId ? prisma.season.findUnique({ where: { id: seasonId }, include: { venue: true } }) : null,
  ]);

  return (
    <div className="min-h-dvh">
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <a href="#contenido-principal" className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-white p-3 font-semibold text-blue-900 focus:not-sr-only focus:outline-2 focus:outline-blue-700">Saltar al contenido</a>
      <Sidebar venue={current?.venue.name ?? "Starfutbol"} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 pr-3 pl-16 backdrop-blur sm:pr-6 lg:pl-6">
          {current ? (
            <SeasonSwitcher seasons={seasons} current={current.id} />
          ) : (
            <span className="text-xs text-zinc-500">Sin temporada configurada</span>
          )}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-zinc-800">{user.name}</p>
              {user.name.toLocaleLowerCase("es-MX") !== ROLE[user.role].toLocaleLowerCase("es-MX") && <p className="text-[11px] text-zinc-500">{ROLE[user.role]}</p>}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </header>
        {current?.isDemo && (
          <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900 sm:px-6">
            Estás viendo la temporada de DEMOSTRACIÓN. Sus datos son ficticios y no forman parte de los registros oficiales.
          </div>
        )}
        <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-[1400px] scroll-mt-16 px-3 py-5 sm:px-6 sm:py-6">
          <Suspense><SectionContext /></Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
