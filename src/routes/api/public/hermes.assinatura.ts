import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  agreement_id: z.string().uuid(),
  status: z.enum(["enviado", "visualizado", "assinado", "recusado", "expirado"]),
  envelope_id: z.string().max(200).optional(),
  declined_reason: z.string().max(1000).optional(),
  document_base64: z.string().optional(),
  file_name: z.string().max(200).optional(),
});

/**
 * Webhook do hermes-agent / Docusign.
 * Recebe o status da assinatura e, quando assinado, o PDF em base64,
 * que é anexado ao histórico do colaborador e do equipamento.
 */
export const Route = createFileRoute("/api/public/hermes/assinatura")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["HERMES_WEBHOOK_SECRET"];
        const provided = request.headers.get("x-hermes-token");
        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "invalid_payload", details: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const data = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: agreement, error } = await supabaseAdmin
          .from("agreements")
          .select("id, employee_id, asset_id")
          .eq("id", data.agreement_id)
          .maybeSingle();
        if (error || !agreement) {
          return new Response(JSON.stringify({ error: "agreement_not_found" }), { status: 404 });
        }

        let storagePath: string | null = null;
        if (data.status === "assinado" && data.document_base64) {
          const bytes = Uint8Array.from(atob(data.document_base64), (c) => c.charCodeAt(0));
          const fileName = data.file_name ?? `termo-assinado-${agreement.id.slice(0, 8)}.pdf`;
          storagePath = `termos/${agreement.id}/${Date.now()}-${fileName.replace(/\s+/g, "-")}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("asset-documents")
            .upload(storagePath, bytes, { contentType: "application/pdf" });
          if (uploadError) {
            return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
          }
          await supabaseAdmin.from("documents").insert({
            agreement_id: agreement.id,
            employee_id: agreement.employee_id,
            asset_id: agreement.asset_id,
            kind: "termo_assinado",
            file_name: fileName,
            storage_path: storagePath,
          });
        }

        const now = new Date().toISOString();
        await supabaseAdmin
          .from("agreements")
          .update({
            status: data.status,
            external_envelope_id: data.envelope_id ?? null,
            declined_reason: data.declined_reason ?? null,
            viewed_at: data.status === "visualizado" ? now : undefined,
            signed_at: data.status === "assinado" ? now : undefined,
            signed_document_path: storagePath,
          } as never)
          .eq("id", agreement.id);

        await supabaseAdmin.from("integration_runs").insert({
          provider: "hermes",
          action: "webhook_assinatura",
          status: "sucesso",
          message: `Termo ${data.agreement_id} atualizado para ${data.status}.`,
        });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
