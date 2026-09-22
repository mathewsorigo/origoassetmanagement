import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Laptop,
  Smartphone,
  FileSignature,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { lazy, Suspense } from "react";

const StatusDonut = lazy(() =>
  import("@/components/painel-charts").then((m) => ({ default: m.StatusDonut })),
);
const TypeBars = lazy(() =>
  import("@/components/painel-charts").then((m) => ({ default: m.TypeBars })),
);
const MonthlyLine = lazy(() =>
  import("@/components/painel-charts").then((m) => ({ default: m.MonthlyLine })),
);
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
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

const statusColors: Record<string, string> = {
  disponivel: "var(--info)",
  em_uso: "var(--success)",
  manutencao: "var(--warning)",
  devolvido: "var(--muted-foreground)",
  extraviado: "var(--destructive)",
};

function ChartFallback() {
  return <Skeleton className="h-52 w-full" />;
}

function Painel() {
  const { data, isLoading } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const CHUNK = 1000;
      async function fetchAll<T>(
        run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
      ) {
        const all: T[] = [];
        for (let from = 0; ; from += CHUNK) {
          const { data, error } = await run(from, from + CHUNK - 1);
          if (error) throw error;
          const rows = data ?? [];
          all.push(...rows);
          if (rows.length < CHUNK) break;
        }
        return all;
      }

      const [assets, employees, timeline, agreements, assignments, signed, pending, active] =
        await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("assets")
            .select("id,status,asset_type,lease_end,serial_number,brand,model")
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase.from("employees").select("id,status").order("id").range(from, to),
        ),
        fetchAll((from, to) =>
          supabase.from("assignments").select("id,assigned_at").order("id").range(from, to),
        ),
        supabase
          .from("agreements")
          .select("id,status,created_at,employee:employees(full_name),asset:assets(serial_number)")
          .not("status", "in", "(assinado,recusado)")
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
        supabase
          .from("agreements")
          .select("id", { count: "exact", head: true })
          .eq("status", "assinado"),
        supabase
          .from("agreements")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(assinado,recusado)"),
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativo"),
      ]);
      return {
        assets,
        employees,
        timeline,
        agreements: agreements.data ?? [],
        assignments: assignments.data ?? [],
        signedCount: signed.count ?? 0,
      };
    },
  });

  const assets = data?.assets ?? [];
  const count = (status: string) => assets.filter((a) => a.status === status).length;
  const pendingAgreements = data?.agreements ?? [];
  const signedCount = data?.signedCount ?? 0;

  const soon = assets
    .filter((a) => {
      if (!a.lease_end) return false;
      const diff = new Date(a.lease_end).getTime() - Date.now();
      return diff > 0 && diff < 1000 * 60 * 60 * 24 * 60;
    })
    .sort((a, b) => String(a.lease_end).localeCompare(String(b.lease_end)));

  const statusData = Object.keys(assetStatusLabel)
    .map((s) => ({ key: s, name: assetStatusLabel[s]!, value: count(s) }))
    .filter((d) => d.value > 0);

  const typeData = Object.keys(assetTypeLabel)
    .map((t) => ({
      name: assetTypeLabel[t]!,
      total: assets.filter((a) => a.asset_type === t).length,
    }))
    .filter((d) => d.total > 0);

  const months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      name: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      total: 0,
    };
  });
  for (const row of data?.timeline ?? []) {
    if (!row.assigned_at) continue;
    const key = String(row.assigned_at).slice(0, 7);
    const m = months.find((x) => x.key === key);
    if (m) m.total += 1;
  }

  return (
    <div>
      <PageHeader
        title="Painel"
        description="Resumo do inventário, vínculos ativos e termos que aguardam assinatura."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de equipamentos"
          value={assets.length}
          icon={Laptop}
          loading={isLoading}
          hint={`${data?.employees.length ?? 0} colaboradores cadastrados`}
        />
        <StatCard
          label="Em uso"
          value={count("em_uso")}
          icon={Smartphone}
          tone="success"
          loading={isLoading}
          hint={`${signedCount} termos assinados`}
        />
        <StatCard
          label="Disponíveis"
          value={count("disponivel")}
          icon={CheckCircle2}
          tone="info"
          loading={isLoading}
          hint="Prontos para entrega"
        />
        <StatCard
          label="Em manutenção"
          value={count("manutencao")}
          icon={AlertTriangle}
          tone="warning"
          loading={isLoading}
          hint={`${soon.length} locações vencendo`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-base">Equipamentos por situação</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : statusData.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">
                Sem equipamentos cadastrados.
              </p>
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <StatusDonut data={statusData} colors={statusColors} />
              </Suspense>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {statusData.map((d) => (
                <span key={d.key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: statusColors[d.key] ?? "var(--chart-1)" }}
                  />
                  {d.name} · <span className="font-semibold">{d.value}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-base">Por tipo de equipamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <TypeBars data={typeData} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-base">Vínculos por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <MonthlyLine data={months} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Termos pendentes</CardTitle>
            <Link to="/termos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingAgreements.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum termo pendente.</p>
            )}
            {pendingAgreements.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
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

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Últimos vínculos</CardTitle>
            <Link to="/vinculos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
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
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
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

        <Card className="shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <CalendarClock className="size-4 text-primary" /> Locações vencendo em 60 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma locação vencendo no período.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {soon.map((a) => {
                  const days = Math.max(
                    0,
                    Math.ceil(
                      (new Date(a.lease_end!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    ),
                  );
                  const pct = Math.min(100, Math.max(4, ((60 - days) / 60) * 100));
                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border p-3 transition-shadow hover:shadow-[var(--shadow-card)]"
                    >
                      <p className="truncate text-sm font-medium">
                        {`${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {assetTypeLabel[a.asset_type]} · {a.serial_number}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-warning to-destructive transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Vence em {days} dia{days === 1 ? "" : "s"} · {formatDate(a.lease_end)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border bg-gradient-to-r from-primary/8 via-card to-card p-4 text-sm text-muted-foreground">
        <FileSignature className="size-4 shrink-0 text-primary" />
        Ao vincular um ativo a um colaborador, o termo de uso é gerado automaticamente e fica
        disponível em Termos para envio de assinatura.
      </div>
    </div>
  );
}
