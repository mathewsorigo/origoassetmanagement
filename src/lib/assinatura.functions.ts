import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const enviarParaAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ agreementId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { dispatchAgreement } = await import("./dispatch-agreement.server");
    return dispatchAgreement(context.supabase, data.agreementId, context.userId);
  });
export const reconcileAgreementDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ agreementId: z.string().uuid(), envelopeId: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const current = await context.supabase
      .from("agreements")
      .select("dispatch_key")
      .eq("id", data.agreementId)
      .single();
    if (current.error) throw current.error;
    if (!current.data.dispatch_key) throw new Error("Não existe envio pendente de conferência.");
    const result = await context.supabase.rpc("qa_transaction", {
      p_action: "dispatch_finish",
      p_data: {
        id: data.agreementId,
        key: current.data.dispatch_key,
        envelope_id: data.envelopeId,
        manual: true,
      },
    });
    if (result.error) throw result.error;
    return { ok: true };
  });
