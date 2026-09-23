import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const queryKeysByTable: Record<string, string[][]> = {
  assets: [["assets"], ["asset"], ["assets-available"], ["contratos-assets"], ["dashboard"]],
  employees: [["employees"], ["employee"], ["employees-simple"], ["dashboard"]],
  assignments: [["assignments"], ["asset-history"], ["employee-history"], ["assets"], ["dashboard"]],
  agreements: [["agreements"], ["agreements-pending-count"], ["dashboard"]],
  documents: [["documents"], ["asset-documents"], ["employee-documents"]],
  inventory_sessions: [["inventory-sessions"]],
  inventory_checks: [["inventory-sessions"], ["inventory-session"]],
  tags: [["tags"], ["asset-tags"]],
  asset_tags: [["asset-tags"], ["assets"]],
  locations: [["locations"]],
  vendors: [["vendors"]],
  departments: [["departments"]],
  agreement_templates: [["agreement-templates"]],
  integration_settings: [["integration-settings"]],
  integration_runs: [["integration-runs"]],
};

export function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("origo-live-data");
    for (const table of Object.keys(queryKeysByTable)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          for (const queryKey of queryKeysByTable[table] ?? []) {
            void queryClient.invalidateQueries({ queryKey });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}