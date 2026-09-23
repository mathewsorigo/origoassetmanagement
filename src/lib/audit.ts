import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    details: (params.details ?? {}) as never,
  });
  if (error)
    throw new Error(
      "A operação foi gravada, mas a auditoria falhou. Atualize a tela antes de tentar novamente.",
    );
}
