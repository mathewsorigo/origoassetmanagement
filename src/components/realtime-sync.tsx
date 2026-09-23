import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const queryKeysByTable: Record<string, string[][]> = {
  assets: [
    ["inventory-scope-assets"],
    ["employees"],
    ["assets"],
    ["asset"],
    ["assets-available"],
    ["contratos-assets"],
    ["painel"],
    ["global-search"],
  ],
  employees: [["employees"], ["employee"], ["employees-simple"], ["painel"], ["global-search"]],
  assignments: [
    ["employees"],
    ["assets-available"],
    ["assignments"],
    ["asset-history"],
    ["employee-history"],
    ["assets"],
    ["painel"],
    ["qr-assignments"],
  ],
  agreements: [["agreements-stats"], ["agreements"], ["agreements-pending-count"], ["painel"]],
  documents: [["documents"], ["asset-documents"], ["employee-documents"]],
  inventory_sessions: [["inventory-sessions"], ["inventory-session"], ["qr-open-inventory"]],
  inventory_checks: [["inventory-sessions"], ["inventory-session"], ["inventory-checks"]],
  tags: [["tags"], ["asset-tags"]],
  asset_tags: [["asset-tags"], ["assets"]],
  locations: [["locations"]],
  vendors: [["vendors"]],
  departments: [["departments"]],
  agreement_templates: [["agreement-templates"], ["templates"]],
  integration_settings: [["integration-settings"]],
  integration_runs: [["integration-runs"]],
  app_settings: [["app-settings"], ["agreements-pending-count"]],
  import_batches: [["import-batches"]],
  import_rows: [["import-errors"], ["import-batches"]],
  audit_log: [["audit"], ["asset-activity"]],
  assignment_checklists: [["asset-history"], ["employee-history"]],
  agreement_reminders: [["agreements"]],
  user_roles: [["roles"], ["access-users"]],
  profiles: [["profile"], ["access-users"]],
  access_allowlist: [["allowed-emails"], ["access-users"]],
  access_denied_attempts: [["denied-attempts"]],
};

export function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("origo-live-data");
    for (const table of Object.keys(queryKeysByTable)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const queryKey of queryKeysByTable[table] ?? []) {
          void queryClient.invalidateQueries({ queryKey });
        }
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
