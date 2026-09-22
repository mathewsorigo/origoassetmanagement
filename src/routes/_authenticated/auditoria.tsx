import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria · Órigo Ativos" },
      {
        name: "description",
        content: "Registro de todas as ações realizadas na gestão de ativos da Órigo Energia.",
      },
      { property: "og:title", content: "Auditoria · Órigo Ativos" },
      { property: "og:description", content: "Histórico de ações e responsáveis." },
    ],
  }),
  component: Auditoria,
});

function Auditoria() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Auditoria" description="Últimas 300 ações registradas no sistema." />
      <Card className="overflow-x-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma ação registrada.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell className="text-sm">{row.actor_email ?? "—"}</TableCell>
                <TableCell className="text-sm font-medium">{row.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.entity}
                  {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
                </TableCell>
                <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                  {row.details ? JSON.stringify(row.details) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
