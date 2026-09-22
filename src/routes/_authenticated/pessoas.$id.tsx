import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pessoas/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do colaborador · Órigo Ativos" },
      {
        name: "description",
        content: "Equipamentos em uso, histórico de entregas e termos assinados do colaborador.",
      },
      { property: "og:title", content: "Ficha do colaborador · Órigo Ativos" },
      { property: "og:description", content: "Histórico de equipamentos e termos do colaborador." },
    ],
  }),
  component: PessoaDetalhe,
});

function PessoaDetalhe() {
  const { id } = Route.useParams();

  const { data: employee } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["employee-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, asset:assets(id,serial_number,brand,model), agreements(id,status)")
        .eq("employee_id", id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const fields: Array<[string, string]> = employee
    ? [
        ["E-mail", employee.email],
        ["CPF", employee.cpf ?? "—"],
        ["Telefone", employee.phone ?? "—"],
        ["Cargo", employee.job_title ?? "—"],
        ["Área", employee.department ?? "—"],
        ["Unidade", employee.unit ?? "—"],
        ["Gestor", employee.manager_name ?? "—"],
      ]
    : [];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/pessoas">
          <ArrowLeft className="mr-2 size-4" /> Voltar para colaboradores
        </Link>
      </Button>

      <PageHeader
        title={employee?.full_name ?? "Colaborador"}
        description={employee?.department ?? undefined}
        actions={employee ? <StatusBadge value={employee.status} /> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <DocumentsPanel filter={{ employeeId: id }} />

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-base">Equipamentos e histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum equipamento vinculado a este colaborador.
              </p>
            )}
            {(history ?? []).map((h) => {
              const asset = h.asset as {
                id: string;
                serial_number: string;
                brand: string | null;
                model: string | null;
              } | null;
              const agreement = (h.agreements as Array<{ id: string; status: string }> | null)?.[0];
              return (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    {asset ? (
                      <Link
                        to="/ativos/$id"
                        params={{ id: asset.id }}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {asset.brand} {asset.model} · {asset.serial_number}
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
