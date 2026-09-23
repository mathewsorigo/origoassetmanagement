import { createFileRoute } from "@tanstack/react-router";
import { AuditBrowser } from "@/components/audit-browser";
export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditBrowser,
  head: () => ({ meta: [{ title: "Auditoria · Órigo Ativos" }] }),
});
