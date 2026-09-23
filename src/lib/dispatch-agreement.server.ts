import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function dispatchAgreement(db: SupabaseClient<Database>, id: string, userId: string) {
  const { data: agreement, error } = await db
    .from("agreements")
    .select(
      "*,employee:employees(full_name,email),asset:assets(serial_number,brand,model,asset_type)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  const settings = await db
    .from("integration_settings")
    .select("*")
    .eq("provider", "hermes")
    .maybeSingle();
  if (settings.error) throw settings.error;
  if (!settings.data?.enabled || !settings.data.base_url)
    return {
      mode: "manual" as const,
      message:
        "A integração de assinatura não está configurada. Colete a assinatura e anexe o documento assinado.",
    };
  const preferences = await db
    .from("app_settings")
    .select("value")
    .eq("key", "termos")
    .maybeSingle();
  if (preferences.error) throw preferences.error;
  const prefs = (preferences.data?.value ?? {}) as Record<string, unknown>;
  const claim = await db.rpc("claim_agreement_dispatch", { p_id: id });
  if (claim.error) throw claim.error;
  const key = claim.data;
  try {
    const response = await fetch(`${settings.data.base_url.replace(/\/$/, "")}/assinaturas`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(process.env["HERMES_AGENT_TOKEN"]
          ? { Authorization: `Bearer ${process.env["HERMES_AGENT_TOKEN"]}` }
          : {}),
      },
      body: JSON.stringify({
        provider: "docusign",
        agreement_id: id,
        idempotency_key: key,
        requested_by: userId,
        signer: agreement.employee,
        asset: agreement.asset,
        document: agreement.content,
        email_subject: prefs["email_assunto"],
        email_message: prefs["email_mensagem"],
        signing_deadline_days: prefs["prazo_dias"] ?? 7,
        reminder_days: prefs["lembrete_dias"] ?? 3,
        reminders_enabled: prefs["lembrete_ativo"] ?? true,
      }),
    });
    if (!response.ok)
      throw new Error(
        `O agente respondeu ${response.status}. Verifique o envio antes de tentar novamente.`,
      );
    const body = (await response.json()) as { envelope_id?: unknown };
    if (typeof body.envelope_id !== "string" || !body.envelope_id.trim())
      throw new Error(
        "O agente não informou o identificador do envelope. Verifique o envio no serviço de assinatura.",
      );
    const finish = await db.rpc("qa_transaction", {
      p_action: "dispatch_finish",
      p_data: { id, key, envelope_id: body.envelope_id },
    });
    if (finish.error) throw finish.error;
    return {
      mode: "enviado" as const,
      message: "Termo enviado para assinatura e registrado no sistema.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível confirmar o envio.";
    const update = await db
      .from("agreements")
      .update({ dispatch_state: "incerto", dispatch_error: message })
      .eq("id", id)
      .eq("dispatch_key", key);
    if (update.error)
      throw new Error(
        "O envio foi iniciado, mas não foi possível registrar sua confirmação. Consulte o agente antes de reenviar.",
      );
    return { mode: "erro" as const, message: `Envio aguardando conferência: ${message}` };
  }
}
