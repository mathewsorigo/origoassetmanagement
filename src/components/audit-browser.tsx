import { useState } from "react";
import { useRemoteList } from "@/hooks/useRemoteList";
import { PageHeader } from "./page-header";
import { QueryError } from "./query-error";
import { TablePagination, SortableHead } from "./data-table-ui";
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from "./ui/table";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { formatDateTime } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { toast } from "sonner";

export function AuditBrowser() {
  const [term, setTerm] = useState(""),
    [actor, setActor] = useState(""),
    [entity, setEntity] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const bounds: { gte?: string; lte?: string } = {};
  if (start) bounds.gte = new Date(start + "T00:00:00").toISOString();
  if (end) bounds.lte = new Date(end + "T23:59:59.999").toISOString();
  const list = useRemoteList({
    view: "audit_list",
    key: "audit",
    term,
    defaultSort: "data",
    defaultSortDir: "desc",
    columns: { data: "created_at", responsavel: "actor_email", acao: "action", registro: "entity" },
    filters: { entity },
    textFilters: { actor_email: actor },
    ranges: { created_at: bounds },
  });
  return (
    <div>
      <PageHeader
        title="Auditoria"
        breadcrumb="Auditoria"
        description="Histórico completo de ações, responsáveis e alterações."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void list
                .loadAll()
                .then((rows) =>
                  exportToExcel(
                    "auditoria",
                    rows.map((r) => ({
                      data: r.created_at,
                      responsavel: r.actor_email ?? r.actor_id,
                      acao: r.action,
                      registro: r.entity,
                      id: r.entity_id,
                      detalhes: JSON.stringify(r.details),
                    })),
                  ),
                )
                .catch((e) => toast.error(e.message))
            }
          >
            Exportar resultados
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label>
          Buscar
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ação, registro ou detalhes"
          />
        </label>
        <label>
          Responsável
          <Input value={actor} onChange={(e) => setActor(e.target.value)} />
        </label>
        <label>
          Entidade
          <Input
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="Ex.: assets"
          />
        </label>
        <label>
          De
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Até
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {list.isError ? (
        <QueryError retry={list.refetch} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  ["data", "Data"],
                  ["responsavel", "Responsável"],
                  ["acao", "Ação"],
                  ["registro", "Registro"],
                ].map(([key, label]) => (
                  <SortableHead
                    key={key}
                    columnKey={key!}
                    label={label!}
                    sortKey={list.table.sortKey}
                    sortDir={list.table.sortDir}
                    onToggle={list.table.toggleSort}
                  />
                ))}
                <TableHead>Alterações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Carregando…</TableCell>
                </TableRow>
              ) : list.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Nenhuma ação corresponde aos filtros.</TableCell>
                </TableRow>
              ) : (
                list.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>{r.actor_email ?? r.actor_id ?? "Sistema"}</TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell>
                      {r.entity}
                      <div className="text-xs">{r.entity_id}</div>
                    </TableCell>
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer">Ver antes / depois e detalhes</summary>
                        <pre className="max-w-xl whitespace-pre-wrap break-all text-xs">
                          {JSON.stringify(r.details ?? {}, null, 2)}
                        </pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            {...list.table}
            onPageChange={list.table.setPage}
            onPageSizeChange={list.table.setPageSize}
            noun="registros"
          />
        </>
      )}
    </div>
  );
}
