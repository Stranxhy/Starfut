import { ConfigTabs } from "./tabs";
import { PageHeader } from "@/components/ui/core";

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Configuración del torneo" />
      <ConfigTabs />
      {children}
    </>
  );
}
