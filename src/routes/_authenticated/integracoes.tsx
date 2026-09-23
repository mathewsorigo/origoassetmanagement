import { QueryError } from "@/components/query-error";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  FileSignature,
  Laptop,
  PlugZap,
  Server,
  History as HistoryIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { IntegrationCard, type IntegrationState } from "@/components/integration-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession, isAdmin } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { testIntegration, syncIntegration } from "@/lib/integracoes.functions";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Central de integrações · Órigo Ativos" },
      {
        name: "description",
        content:
          "Estado, testes e sincronizações do hermes-agent, Docusign, Intune, Easy e Simpress.",
      },
      { property: "og:title", content: "Central de integrações · Órigo Ativos" },
      {
        property: "og:description",
        content: "Estado das integrações, última sincronização e histórico de execuções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integracoes,
});

const meta: Record<
  string,
  { title: string; description: string; urlLabel: string; icon: typeof PlugZap; missing?: string[] }
> = {
  hermes: {
    title: "hermes-agent",
    description:
      "Executa todas as integrações externas. Com o endereço e a chave do agente, a plataforma envia termos e sincronizações por ele.",
    urlLabel: "Endereço do hermes-agent",
    icon: Server,
    missing: ["Endereço do agente", "Chave de acesso do agente"],
  },
  docusign: {
    title: "Docusign",
    description:
      "Assinatura eletrônica dos termos. O envio sai pelo hermes-agent e o documento assinado volta pelo endereço de retorno.",
    urlLabel: "Endereço/conta Docusign",
    icon: FileSignature,
    missing: ["Conta Docusign no hermes-agent"],
  },
  intune: {
    title: "Microsoft Intune",
    description:
      "Traz os equipamentos gerenciados (série, modelo e usuário principal) para o inventário.",
    urlLabel: "Endereço da sincronização",
    icon: Laptop,
    missing: ["Credenciais do Intune no hermes-agent"],
  },
  easy: {
    title: "Easy",
    description: "Importa os dados do Easy para a base central de equipamentos.",
    urlLabel: "Endereço do Easy",
    icon: Boxes,
    missing: ["Credenciais do Easy no hermes-agent"],
  },
  simpress: {
    title: "Simpress",
    description: "Contratos, locações e faturamento dos equipamentos alugados.",
    urlLabel: "Endereço da Simpress",
    icon: Boxes,
    missing: ["Credenciais da Simpress no hermes-agent"],
  },
};

type Run = {
  id: string;
  provider: string;
  action: string;
  status: string;
  message: string | null;
  payload: { items?: number } | null;
  created_at: string;
};

function Integracoes() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isAdmin(roles);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, "teste" | "sync" | null>>({});

  const runTest = useServerFn(testIntegration);
  const runSync = useServerFn(syncIntegration);

  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["integration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .order("provider");
      if (error) throw error;
      return data;
    },
  });

  const {
    data: runs,
    isError: runsError,
    refetch: retryRuns,
  } = useQuery({
    queryKey: ["integration-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data as unknown as Run[];
    },
  });

  const lastByProvider = useMemo(() => {
    const map = new Map<string, Run>();
    for (const r of runs ?? []) if (!map.has(r.provider)) map.set(r.provider, r);
    return map;
  }, [runs]);

  const save = useMutation({
    mutationFn: async (input: {
      id: string;
      provider: string;
      enabled?: boolean;
      base_url?: string;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.enabled !== undefined) patch["enabled"] = input.enabled;
      if (input.base_url !== undefined) patch["base_url"] = input.base_url || null;
      const { error } = await supabase
        .from("integration_settings")
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;
      await logAudit({
        action: "atualizar_integracao",
        entity: "integration_settings",
        entityId: input.id,
        details: { provider: input.provider, ...patch },
      });
    },
    onSuccess: () => {
      toast.success("Integração atualizada.");
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAction(provider: string, kind: "teste" | "sync") {
    setBusy((b) => ({ ...b, [provider]: kind }));
    try {
      const result =
        kind === "teste"
          ? await runTest({ data: { provider } })
          : await runSync({ data: { provider } });
      if (result.ok) toast.success(result.message);
      else toast.warning(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível executar.");
    } finally {
      setBusy((b) => ({ ...b, [provider]: null }));
      queryClient.invalidateQueries({ queryKey: ["integration-runs"] });
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
    }
  }

  if (isError) return <QueryError retry={refetch} />;
  return (
    <div>
      <PageHeader
        breadcrumb="Central de integrações"
        title="Central de integrações"
        description="Toda a execução externa passa pelo hermes-agent. Veja o estado de cada serviço, teste a conexão e acompanhe as execuções."
      />

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(settings ?? []).map((s) => {
            const m = meta[s.provider] ?? {
              title: s.provider,
              description: "",
              urlLabel: "Endereço do serviço",
              icon: PlugZap,
            };
            const value = drafts[s.id] ?? s.base_url ?? "";
            const last = lastByProvider.get(s.provider);
            const state: IntegrationState = !s.base_url
              ? "nao_configurada"
              : !s.enabled
                ? "desativada"
                : last?.status === "erro"
                  ? "erro"
                  : "conectada";
            return (
              <IntegrationCard
                key={s.id}
                title={m.title}
                description={m.description}
                urlLabel={m.urlLabel}
                icon={m.icon}
                state={state}
                enabled={s.enabled}
                value={value}
                lastSyncAt={s.last_sync_at ?? null}
                lastMessage={last?.message ?? null}
                lastItems={last?.payload?.items ?? null}
                canEdit={canEdit}
                busy={busy[s.provider] ?? null}
                missing={state === "nao_configurada" ? m.missing : undefined}
                onValueChange={(v) => setDrafts({ ...drafts, [s.id]: v })}
                onSaveUrl={() => save.mutate({ id: s.id, provider: s.provider, base_url: value })}
                onToggle={(checked) =>
                  save.mutate({ id: s.id, provider: s.provider, enabled: checked })
                }
                onTest={() => handleAction(s.provider, "teste")}
                onSync={() => handleAction(s.provider, "sync")}
              />
            );
          })}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Execuções recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {runsError ? (
            <QueryError retry={retryRuns} />
          ) : (runs ?? []).length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="Nenhuma execução registrada"
              description="Testes e sincronizações aparecem aqui com data, resultado e mensagem."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="num whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {meta[r.provider]?.title ?? r.provider}
                      </TableCell>
                      <TableCell className="text-[13px]">{r.action}</TableCell>
                      <TableCell>
                        <StatusBadge value={r.status} />
                      </TableCell>
                      <TableCell className="max-w-96 truncate text-xs text-muted-foreground">
                        {r.message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 rounded-lg border bg-card p-4 text-[13px] text-muted-foreground">
        Endereço para o hermes-agent devolver o documento assinado:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          /api/public/hermes/assinatura
        </code>{" "}
        (POST, autenticado por chave compartilhada).
      </div>
    </div>
  );
}
