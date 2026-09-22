import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ agreementId: z.string().uuid() });

/**
 * Dispara o termo para assinatura eletrônica.
 *
 * O envio real é executado pelo hermes-agent (ou por um endpoint Docusign
 * próprio). Enquanto a integração não estiver ativa e configurada, a função
 * devolve o modo "manual" para que o time siga anexando o documento assinado
 * pela tela de Termos.
 */
export const enviarParaAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: agreement, error } = await supabase
      .from("agreements")
      .select(
        "id, content, status, employee:employees(full_name,email), asset:assets(serial_number,brand,model,asset_type)",
      )
      .eq("id", data.agreementId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!agreement) throw new Error("Termo não encontrado.");

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("provider, enabled, base_url, config")
      .in("provider", ["hermes", "docusign"]);

    const hermes = settings?.find((s) => s.provider === "hermes");
    const docusign = settings?.find((s) => s.provider === "docusign");
    const target = hermes?.enabled && hermes.base_url ? hermes : null;

    if (!target) {
      await supabase.from("integration_runs").insert({
        provider: "hermes",
        action: "enviar_termo",
        status: "pendente_configuracao",
        message:
          "Integração não configurada. O termo ficou em rascunho para envio manual ou posterior.",
        payload: { agreement_id: agreement.id } as never,
      });
      return {
        mode: "manual" as const,
        message:
          "A integração de assinatura ainda não está configurada. Gere o termo, colete a assinatura e anexe o documento assinado.",
      };
    }

    const token = process.env["HERMES_AGENT_TOKEN"];
    let status = "sucesso";
    let message = "Termo enviado para assinatura.";
    let externalId: string | null = null;

    try {
      const res = await fetch(`${target.base_url!.replace(/\/$/, "")}/assinaturas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: docusign?.enabled ? "docusign" : "docusign",
          agreement_id: agreement.id,
          requested_by: userId,
          signer: agreement.employee,
          asset: agreement.asset,
          document: agreement.content,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Falha ${res.status}: ${body.slice(0, 300)}`);
      try {
        externalId = (JSON.parse(body) as { envelope_id?: string }).envelope_id ?? null;
      } catch {
        externalId = null;
      }
    } catch (err) {
      status = "erro";
      message = err instanceof Error ? err.message : "Erro desconhecido ao enviar o termo.";
    }

    await supabase.from("integration_runs").insert({
      provider: "hermes",
      action: "enviar_termo",
      status,
      message,
      payload: { agreement_id: agreement.id } as never,
    });

    if (status === "sucesso") {
      await supabase
        .from("agreements")
        .update({
          status: "enviado",
          sent_at: new Date().toISOString(),
          external_envelope_id: externalId,
        })
        .eq("id", agreement.id);
      return { mode: "enviado" as const, message };
    }

    return { mode: "erro" as const, message };
  });
