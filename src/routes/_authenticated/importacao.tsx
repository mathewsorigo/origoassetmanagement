import { createFileRoute } from "@tanstack/react-router";
import { ImportWorkbench } from "@/components/import-workbench";
export const Route = createFileRoute("/_authenticated/importacao")({
  component: ImportWorkbench,
  head: () => ({ meta: [{ title: "Importação · Órigo Ativos" }] }),
});
