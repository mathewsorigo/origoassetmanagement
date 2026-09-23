import { supabase } from "@/integrations/supabase/client";

export async function archiveEntities(
  entity: "assets" | "employees",
  ids: string[],
  restore = false,
) {
  const { error } = await supabase.rpc("archive_entities", {
    p_entity: entity,
    p_ids: ids,
    p_restore: restore,
  });
  if (error) throw error;
}

export async function archiveAsset(assetId: string, restore = false) {
  return archiveEntities("assets", [assetId], restore);
}
export async function archiveEmployee(employeeId: string, restore = false) {
  return archiveEntities("employees", [employeeId], restore);
}
