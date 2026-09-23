import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationCheck = {
  provider: string;
  ok: boolean;
  message: string;
  latencyMs: number | null;
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const client = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data } = await client.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Apenas administradores podem executar integrações.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadSetting(provider: string) {
  const db = await admin();
  const { data, error } = await db
    .from("integration_settings")
    .select("id,provider,enabled,base_url,last_sync_at")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Integração não encontrada.");
  return data;
}

async function recordRun(input: {
  provider: string;
  action: string;
  status: string;
  message: string;
}) {
  const db = await admin();
  const { error } = await db.from("integration_runs").insert({
    provider: input.provider,
    action: input.action,
    status: input.status,
    message: input.message,
  } as never);
  if (error)
    throw new Error(
      "A solicitação foi processada, mas o histórico não pôde ser gravado: " + error.message,
    );
}

async function callAgent(url: string, init?: RequestInit) {
  const token = process.env["HERMES_AGENT_TOKEN"];
  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: body.slice(0, 500),
    latencyMs: Date.now() - started,
  };
}

/** Testa a conexão com a integração e registra o resultado no histórico. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: string }) => {
    if (!data?.provider) throw new Error("Informe a integração.");
    return { provider: String(data.provider) };
  })
  .handler(async ({ data, context }): Promise<IntegrationCheck> => {
    await assertAdmin(context as never);
    const setting = await loadSetting(data.provider);

    if (!setting.base_url) {
      const message = "Endereço do serviço ainda não informado.";
      await recordRun({ provider: data.provider, action: "teste", status: "pendente", message });
      return { provider: data.provider, ok: false, message, latencyMs: null };
    }

    try {
      const base = setting.base_url.replace(/\/+$/, "");
      const res = await callAgent(`${base}/health`);
      const message = res.ok
        ? `Conexão bem-sucedida (${res.status}).`
        : `Serviço respondeu ${res.status}: ${res.body || "sem detalhes"}`;
      await recordRun({
        provider: data.provider,
        action: "teste",
        status: res.ok ? "sucesso" : "erro",
        message,
      });
      return { provider: data.provider, ok: res.ok, message, latencyMs: res.latencyMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao conectar.";
      await recordRun({ provider: data.provider, action: "teste", status: "erro", message });
      return { provider: data.provider, ok: false, message, latencyMs: null };
    }
  });

/** Pede ao hermes-agent uma sincronização do provedor e registra o resultado. */
export const syncIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: string }) => {
    if (!data?.provider) throw new Error("Informe a integração.");
    return { provider: String(data.provider) };
  })
  .handler(async ({ data, context }): Promise<IntegrationCheck> => {
    await assertAdmin(context as never);
    const setting = await loadSetting(data.provider);
    const hermes = await loadSetting("hermes").catch(() => null);
    const base = (setting.base_url || hermes?.base_url || "").replace(/\/+$/, "");

    if (!setting.enabled) {
      const message = "Integração desativada. Ative antes de sincronizar.";
      await recordRun({
        provider: data.provider,
        action: "sincronizar",
        status: "pendente",
        message,
      });
      return { provider: data.provider, ok: false, message, latencyMs: null };
    }
    if (!base) {
      const message = "Endereço do hermes-agent ainda não informado.";
      await recordRun({
        provider: data.provider,
        action: "sincronizar",
        status: "pendente",
        message,
      });
      return { provider: data.provider, ok: false, message, latencyMs: null };
    }

    try {
      const res = await callAgent(`${base}/sync/${data.provider}`, {
        method: "POST",
        body: JSON.stringify({ provider: data.provider }),
      });
      const message = res.ok
        ? `Solicitação aceita (${res.status}). A conclusão depende da confirmação do agente. ${res.body}`.trim()
        : `Serviço respondeu ${res.status}: ${res.body || "sem detalhes"}`;
      await recordRun({
        provider: data.provider,
        action: "sincronizar",
        status: res.ok ? "solicitado" : "erro",
        message,
      });
      return { provider: data.provider, ok: res.ok, message, latencyMs: res.latencyMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar.";
      await recordRun({ provider: data.provider, action: "sincronizar", status: "erro", message });
      return { provider: data.provider, ok: false, message, latencyMs: null };
    }
  });
