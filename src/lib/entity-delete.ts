import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

async function hasActiveAssignment(column: "asset_id" | "employee_id", id: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("id")
    .eq(column, id)
    .eq("status", "ativo")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function deleteAssetCascade(assetId: string, details?: Record<string, unknown>) {
  if (await hasActiveAssignment("asset_id", assetId))
    throw new Error("Este equipamento tem vínculo ativo. Registre a devolução antes de excluir.");

  const steps = [
    supabase.from("documents").delete().eq("asset_id", assetId),
    supabase.from("agreements").delete().eq("asset_id", assetId),
    supabase.from("assignments").delete().eq("asset_id", assetId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw error;
  }

  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;

  await logAudit({ action: "excluir", entity: "assets", entityId: assetId, details: details ?? {} });
}

export async function deleteEmployeeCascade(
  employeeId: string,
  details?: Record<string, unknown>,
) {
  if (await hasActiveAssignment("employee_id", employeeId))
    throw new Error(
      "Esta pessoa tem equipamento em uso. Registre a devolução antes de excluir o cadastro.",
    );

  const steps = [
    supabase.from("documents").delete().eq("employee_id", employeeId),
    supabase.from("agreements").delete().eq("employee_id", employeeId),
    supabase.from("assignments").delete().eq("employee_id", employeeId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw error;
  }

  const { error } = await supabase.from("employees").delete().eq("id", employeeId);
  if (error) throw error;

  await logAudit({
    action: "excluir",
    entity: "employees",
    entityId: employeeId,
    details: details ?? {},
  });
}
