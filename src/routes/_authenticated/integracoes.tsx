import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession, isAdmin } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações · Órigo Ativos" },
      {
        name: "description",
        content: "Configuração do hermes-agent, Docusign, Intune, Easy e Simpress.",
      },
      { property: "og:title", content: "Integrações · Órigo Ativos" },
      { property: "og:description", content: "Status e configuração das integrações da plataforma." },
    ],
  }),
  component: Integracoes,
});

const descriptions: Record<string, { title: string; description: string; urlLabel: string }> = {
  hermes: {
    title: "hermes-agent",
    description:
      "Executa todas as integrações externas. Informe a URL base do agente; a plataforma envia os termos e as sincronizações por ele.",
    urlLabel: "URL base do hermes-agent",
  },
  docusign: {
    title: "Docusign",
    description:
      "Assinatura eletrônica dos termos de uso. O envio é feito pelo hermes-agent e o documento assinado volta pelo webhook.",
    urlLabel: "URL/conta Docusign (opcional)",
  },
  intune: {
    title: "Microsoft Intune",
    description:
      "Sincroniza os dispositivos gerenciados (série, modelo, usuário principal) com o inventário.",
    urlLabel: "URL base da sincronização",
  },
  easy: {
    title: "Easy",
    description: "Importa dados do Easy para a plataforma central.",
    urlLabel: "URL base do Easy",
  },
  simpress: {
    title: "Simpress",
    description: "Contratos e faturamento dos equipamentos alugados.",
    urlLabel: "URL base da Simpress",
  },
};

function Integracoes() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isAdmin(roles);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
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

  const { data: runs } = useQuery({
    queryKey: ["integration-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (input: { id: string; provider: string; enabled?: boolean; base_url?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      if (input.base_url !== undefined) patch.base_url = input.base_url || null;
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

  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Toda a execução externa passa pelo hermes-agent. Ative e informe as URLs quando o agente estiver disponível."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {(settings ?? []).map((s) => {
          const meta = descriptions[s.provider] ?? {
            title: s.provider,
            description: "",
            urlLabel: "URL base",
          };
          const value = drafts[s.id] ?? s.base_url ?? "";
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-base">{meta.title}</CardTitle>
                    <CardDescription className="mt-1">{meta.description}</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      s.enabled
                        ? "bg-success/15 text-success border-success/30"
                        : "text-muted-foreground"
                    }
                  >
                    {s.enabled ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>{meta.urlLabel}</Label>
                  <Input
                    value={value}
                    disabled={!canEdit}
                    placeholder="https://"
                    onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={s.enabled}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        save.mutate({ id: s.id, provider: s.provider, enabled: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">Integração ativa</span>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        save.mutate({ id: s.id, provider: s.provider, base_url: value })
                      }
                    >
                      Salvar URL
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Última sincronização: {formatDateTime(s.last_sync_at)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-4">
        <CardTitle className="mb-3 font-display text-base">Execuções recentes</CardTitle>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Integração</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma execução registrada.
                  </TableCell>
                </TableRow>
              )}
              {(runs ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{r.provider}</TableCell>
                  <TableCell className="text-sm">{r.action}</TableCell>
                  <TableCell className="text-sm">{r.status}</TableCell>
                  <TableCell className="max-w-96 truncate text-xs text-muted-foreground">
                    {r.message ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="mt-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Endereço para o hermes-agent devolver o documento assinado:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          /api/public/hermes/assinatura
        </code>{" "}
        (POST, autenticado por token compartilhado).
      </div>
    </div>
  );
}
