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
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";

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

  const table = useTableState(data, {
    key: "auditoria",
    accessors: {
      data: (row) => row.created_at,
      responsavel: (row) => row.actor_email,
      acao: (row) => row.action,
      registro: (row) => row.entity,
    },
  });

  return (
    <div>
      <PageHeader title="Auditoria" description="Últimas 300 ações registradas no sistema." />
      <Card className="overflow-x-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ["data", "Data"],
                  ["responsavel", "Responsável"],
                  ["acao", "Ação"],
                  ["registro", "Registro"],
                ] as const
              ).map(([columnKey, label]) => (
                <SortableHead
                  key={columnKey}
                  columnKey={columnKey}
                  label={label}
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onToggle={table.toggleSort}
                />
              ))}
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
            {!isLoading && table.total === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma ação registrada.
                </TableCell>
              </TableRow>
            )}
            {table.pageRows.map((row) => (
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
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="registros"
          total={table.total}
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          page={table.page}
          pageCount={table.pageCount}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>
    </div>
  );
}
