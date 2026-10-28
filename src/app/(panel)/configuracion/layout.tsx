import { ConfigTabs } from "./tabs";
import { PageHeader } from "@/components/ui/core";

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Configuración del torneo" description="Organiza las fechas, los espacios de juego y las reglas. Elige la sección que necesitas ajustar." />
      <ConfigTabs />
      {children}
    </>
  );
}
