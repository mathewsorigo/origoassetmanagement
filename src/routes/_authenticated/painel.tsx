import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Laptop, Smartphone, FileSignature, AlertTriangle, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { assetStatusLabel, assetTypeLabel, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Órigo Ativos" },
      {
        name: "description",
        content: "Visão geral dos equipamentos, vínculos e termos pendentes de assinatura.",
      },
      { property: "og:title", content: "Painel · Órigo Ativos" },
      { property: "og:description", content: "Visão geral do inventário de TI da Órigo Energia." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data, isLoading } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [assets, employees, agreements, assignments] = await Promise.all([
        supabase.from("assets").select("id,status,asset_type,lease_end,serial_number,brand,model"),
        supabase.from("employees").select("id,status"),
        supabase
          .from("agreements")
          .select("id,status,created_at,employee:employees(full_name),asset:assets(serial_number)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("assignments")
          .select(
            "id,assigned_at,status,employee:employees(full_name),asset:assets(serial_number,brand,model)",
          )
          .eq("status", "ativo")
          .order("assigned_at", { ascending: false })
          .limit(8),
      ]);
      if (assets.error) throw assets.error;
      return {
        assets: assets.data ?? [],
        employees: employees.data ?? [],
        agreements: agreements.data ?? [],
        assignments: assignments.data ?? [],
      };
    },
  });

  const assets = data?.assets ?? [];
  const count = (status: string) => assets.filter((a) => a.status === status).length;
  const pendingAgreements = (data?.agreements ?? []).filter(
    (a) => a.status !== "assinado" && a.status !== "recusado",
  );
  const soon = assets.filter((a) => {
    if (!a.lease_end) return false;
    const diff = new Date(a.lease_end).getTime() - Date.now();
    return diff > 0 && diff < 1000 * 60 * 60 * 24 * 60;
  });

  const cards = [
    { label: "Total de equipamentos", value: assets.length, icon: Laptop },
    { label: "Em uso", value: count("em_uso"), icon: Smartphone },
    { label: "Disponíveis", value: count("disponivel"), icon: Laptop },
    { label: "Em manutenção", value: count("manutencao"), icon: AlertTriangle },
  ];

  return (
    <div>
      <PageHeader
        title="Painel"
        description="Resumo do inventário, vínculos ativos e termos que aguardam assinatura."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-[var(--shadow-card)]">
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold">
                  {isLoading ? "—" : c.value}
                </p>
              </div>
              <div className="flex size-11 items-center justify-center rounded-xl bg-accent">
                <c.icon className="size-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Termos pendentes</CardTitle>
            <Link to="/termos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAgreements.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum termo pendente.</p>
            )}
            {pendingAgreements.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(a.employee as { full_name?: string } | null)?.full_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Série {(a.asset as { serial_number?: string } | null)?.serial_number ?? "—"}
                  </p>
                </div>
                <StatusBadge value={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Últimos vínculos</CardTitle>
            <Link to="/vinculos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.assignments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum vínculo ativo.</p>
            )}
            {(data?.assignments ?? []).map((a) => {
              const asset = a.asset as {
                serial_number?: string;
                brand?: string;
                model?: string;
              } | null;
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {(a.employee as { full_name?: string } | null)?.full_name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {asset?.brand} {asset?.model} · {asset?.serial_number}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(a.assigned_at)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <CalendarClock className="size-4 text-primary" /> Locações vencendo em 60 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma locação vencendo no período.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {soon.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      {a.brand} {a.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {assetTypeLabel[a.asset_type]} · {a.serial_number}
                    </p>
                    <p className="mt-1 text-xs text-warning-foreground">
                      Vence em {formatDate(a.lease_end)} · {assetStatusLabel[a.status]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <FileSignature className="size-4 text-primary" />
        Ao vincular um ativo a um colaborador, o termo de uso é gerado automaticamente e fica
        disponível em Termos para envio de assinatura.
      </div>
    </div>
  );
}
