import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { assetTypeLabel, formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ativos/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do ativo · Órigo Ativos" },
      {
        name: "description",
        content: "Ficha completa do equipamento com histórico de uso e documentos assinados.",
      },
      { property: "og:title", content: "Ficha do ativo · Órigo Ativos" },
      { property: "og:description", content: "Histórico de uso e documentos do equipamento." },
    ],
  }),
  component: AtivoDetalhe,
});

function AtivoDetalhe() {
  const { id } = Route.useParams();

  const { data: asset } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["asset-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, employee:employees(id,full_name,email), agreements(id,status,signed_at)")
        .eq("asset_id", id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const fields: Array<[string, string]> = asset
    ? [
        ["Tipo", assetTypeLabel[asset.asset_type] ?? asset.asset_type],
        ["Marca", asset.brand ?? "—"],
        ["Modelo", asset.model ?? "—"],
        ["Número de série", asset.serial_number],
        ["Patrimônio", asset.patrimony ?? "—"],
        ["IMEI", asset.imei ?? "—"],
        ["Fornecedor", asset.supplier ?? "—"],
        ["Contrato", asset.contract_number ?? "—"],
        ["Localidade", asset.location ?? "—"],
        ["Condição", asset.condition ?? "—"],
        ["Custo mensal", formatMoney(asset.monthly_cost)],
        ["Início da locação", formatDate(asset.lease_start)],
        ["Fim da locação", formatDate(asset.lease_end)],
        ["Última sincronização Intune", formatDateTime(asset.intune_last_sync)],
      ]
    : [];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/ativos">
          <ArrowLeft className="mr-2 size-4" /> Voltar para ativos
        </Link>
      </Button>

      <PageHeader
        title={asset ? `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number : "Ativo"}
        description={asset ? `Série ${asset.serial_number}` : undefined}
        actions={asset ? <StatusBadge value={asset.status} /> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Dados do equipamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm">{value}</p>
              </div>
            ))}
            {asset?.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <DocumentsPanel filter={{ assetId: id }} />

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-base">Histórico de uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Este ativo ainda não foi vinculado.</p>
            )}
            {(history ?? []).map((h) => {
              const employee = h.employee as { id: string; full_name: string; email: string } | null;
              const agreement = (h.agreements as Array<{ id: string; status: string }> | null)?.[0];
              return (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    {employee ? (
                      <Link
                        to="/pessoas/$id"
                        params={{ id: employee.id }}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {employee.full_name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">—</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Entrega {formatDate(h.assigned_at)}
                      {h.returned_at ? ` · Devolução ${formatDate(h.returned_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {agreement && <StatusBadge value={agreement.status} />}
                    <StatusBadge value={h.status} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
