import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { importPayload } from "@/lib/import-data";
import { fetchAll } from "@/lib/fetch-all";
import { readSpreadsheet, exportToExcel } from "@/lib/excel";
import { PageHeader } from "./page-header";
import { QueryError } from "./query-error";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "./ui/table";
import { TablePagination } from "./data-table-ui";
import { useTableState } from "@/hooks/useTableState";
import type { Json } from "@/integrations/supabase/types";

type Preview = {
  line: number;
  payload: Record<string, string | number | boolean | null>;
  before: Record<string, unknown> | null;
  changes: Record<string, unknown>;
  error: string | null;
};
const fieldLabels: Record<string, string> = {
  serial_number: "Série",
  asset_type: "Tipo",
  brand: "Marca",
  model: "Modelo",
  patrimony: "Patrimônio",
  supplier: "Fornecedor",
  contract_number: "Contrato",
  monthly_cost: "Custo mensal",
  lease_start: "Início da locação",
  lease_end: "Fim da locação",
  location: "Localidade",
  last_seen_location: "Última localidade",
  bitdefender_installed: "Bitdefender instalado",
  full_name: "Nome",
  email: "E-mail",
  cpf: "CPF",
  phone: "Telefone",
  job_title: "Cargo",
  department: "Área",
  unit: "Unidade",
  manager_name: "Gestor",
};
const display = (value: unknown) =>
  value === null || value === undefined
    ? "Vazio"
    : typeof value === "boolean"
      ? value
        ? "Sim"
        : "Não"
      : String(value);
const headers = {
  ativos: [
    "serial",
    "tipo",
    "marca",
    "modelo",
    "patrimonio",
    "imei",
    "fornecedor",
    "contrato",
    "custo_mensal",
    "inicio_locacao",
    "fim_locacao",
    "localidade",
    "ultima_localidade_vista",
    "bitdefender_instalado",
  ],
  colaboradores: ["email", "nome", "cpf", "cargo", "area", "unidade", "gestor", "telefone"],
};
export function ImportWorkbench() {
  const client = useQueryClient();
  const [kind, setKind] = useState<"ativos" | "colaboradores">("ativos");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const stop = useRef(false);
  const operationId = useRef(crypto.randomUUID());
  const [reportId, setReportId] = useState<string | null>(null);
  const batches = useQuery({
    queryKey: ["import-batches"],
    queryFn: async () => {
      const r = await supabase
        .from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const report = useQuery({
    queryKey: ["import-errors", reportId],
    enabled: !!reportId,
    queryFn: () =>
      fetchAll((from, to) =>
        supabase
          .from("import_rows")
          .select("*")
          .eq("batch_id", reportId!)
          .order("row_number")
          .range(from, to),
      ),
  });
  const table = useTableState(preview, {
    key: "import-preview",
    accessors: { linha: (r) => r.line },
  });
  async function prepare() {
    if (!file) return;
    setBusy(true);
    setPreview([]);
    try {
      const rows = await readSpreadsheet(await file.arrayBuffer());
      if (!rows.length) throw new Error("Planilha vazia.");
      const existing =
        kind === "ativos"
          ? await fetchAll((from, to) =>
              supabase.from("assets").select("*").order("id").range(from, to),
            )
          : await fetchAll((from, to) =>
              supabase.from("employees").select("*").order("id").range(from, to),
            );
      const key = kind === "ativos" ? "serial_number" : "email";
      const byKey = new Map(
        existing.map((r) => [
          String((r as unknown as Record<string, unknown>)[key]).toLowerCase(),
          r as unknown as Record<string, unknown>,
        ]),
      );
      const seen = new Set<string>();
      setPreview(
        rows.map((row, i) => {
          try {
            const payload = importPayload(row, kind),
              identity = String(payload[key]).toLowerCase(),
              before = byKey.get(identity) ?? null;
            if (seen.has(identity)) throw new Error("Identificador repetido na planilha.");
            seen.add(identity);
            if (before?.["archived_at"])
              throw new Error("Cadastro arquivado; restaure antes de importar.");
            if (!before && kind !== "ativos" && !payload["full_name"])
              throw new Error("Nome obrigatório para novo colaborador.");
            const changes = Object.fromEntries(
              Object.entries(payload)
                .filter(([k, v]) => !before || before[k] !== v)
                .map(([k, v]) => [k, { antes: before?.[k] ?? null, depois: v }]),
            );
            return { line: i + 2, payload, before, changes, error: null };
          } catch (e) {
            return {
              line: i + 2,
              payload: {},
              before: null,
              changes: {},
              error: e instanceof Error ? e.message : String(e),
            };
          }
        }),
      );
      operationId.current = crypto.randomUUID();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function run(batchId?: string) {
    setBusy(true);
    stop.current = false;
    let id = batchId;
    try {
      if (!id) {
        const r = await supabase.rpc("prepare_import", {
          p_id: operationId.current,
          p_kind: kind,
          p_name: file?.name ?? "Planilha",
          p_rows: preview.map((r) => r.payload) as Json,
        });
        if (r.error) throw r.error;
        id = r.data;
      }
      setReportId(id);
      const rows = await fetchAll((from, to) =>
        supabase
          .from("import_rows")
          .select("row_number,result")
          .eq("batch_id", id!)
          .in("result", ["pendente", "erro"])
          .order("row_number")
          .range(from, to),
      );
      for (let i = 0; i < rows.length; i++) {
        if (stop.current) break;
        setProgress("Processando " + (i + 1) + " de " + rows.length);
        const r = await supabase.rpc("apply_import_row", {
          p_batch: id,
          p_line: rows[i]!.row_number,
        });
        if (r.error) throw r.error;
      }
      const finish = await supabase.rpc("finish_import", { p_id: id });
      if (finish.error) throw finish.error;
      toast.info(
        stop.current
          ? "Lote pausado. Você pode retomá-lo pelo histórico."
          : "Processamento finalizado. Confira os resultados e eventuais erros no relatório.",
      );
      setPreview([]);
      setFile(null);
    } catch (e) {
      toast.error(
        "Processamento interrompido: " +
          (e instanceof Error ? e.message : String(e)) +
          ". Retome pelo histórico; linhas concluídas não serão repetidas.",
      );
    } finally {
      setBusy(false);
      setProgress("");
      void client.invalidateQueries();
    }
  }
  return (
    <div>
      <PageHeader
        title="Importação por planilha"
        breadcrumb="Importação"
        description="Confira as alterações antes de importar. Campos ausentes ou vazios preservam os dados existentes."
      />
      <Card className="space-y-4 p-4">
        <label className="block space-y-1">
          Tipo de cadastro
          <select
            aria-label="Tipo de cadastro"
            className="ml-3 rounded border p-2"
            disabled={busy}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setPreview([]);
            }}
          >
            <option value="ativos">Ativos</option>
            <option value="colaboradores">Colaboradores</option>
          </select>
        </label>
        <label className="block">
          Planilha
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview([]);
            }}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Para apagar explicitamente um campo opcional, use [LIMPAR]. Valores: 1.234,56. Datas:
          dd/mm/aaaa.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void exportToExcel("modelo-" + kind, [
                Object.fromEntries(headers[kind].map((h) => [h, ""])),
              ]).catch((e) => toast.error(String(e)))
            }
          >
            Baixar modelo
          </Button>
          <Button disabled={!file || busy} onClick={() => void prepare()}>
            Analisar planilha
          </Button>
        </div>
        {!!preview.length && (
          <>
            <p>
              {preview.length} linhas · {preview.filter((r) => r.error).length} com erro. Revise
              antes de confirmar.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Alterações / erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.pageRows.map((r) => (
                  <TableRow key={r.line}>
                    <TableCell>{r.line}</TableCell>
                    <TableCell>{r.error ? "Corrigir" : r.before ? "Atualizar" : "Criar"}</TableCell>
                    <TableCell className="max-w-2xl whitespace-pre-wrap break-words">
                      {r.error ??
                        Object.entries(r.changes)
                          .map(([field, value]) => {
                            const change = value as { antes: unknown; depois: unknown };
                            return `${fieldLabels[field] ?? field}: ${display(change.antes)} → ${display(change.depois)}`;
                          })
                          .join("\n")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              {...table}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
              noun="linhas"
            />
            <Button disabled={busy || preview.some((r) => r.error)} onClick={() => void run()}>
              Confirmar importação revisada
            </Button>
          </>
        )}
        {busy && (
          <div role="status">
            {progress || "Analisando…"}{" "}
            {progress && (
              <Button
                variant="outline"
                onClick={() => {
                  stop.current = true;
                }}
              >
                Pausar após esta linha
              </Button>
            )}
          </div>
        )}
      </Card>
      <Card className="mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Histórico de lotes (50 mais recentes)</h2>
        {batches.isError && <QueryError retry={batches.refetch} />}{" "}
        {batches.isLoading && <p>Carregando…</p>}
        {batches.data?.map((b) => (
          <div className="flex flex-wrap items-center gap-3 border-b py-2" key={b.id}>
            <span>
              {b.file_name} · {b.status} · {b.created_rows} criados · {b.updated_rows} atualizados ·{" "}
              {b.failed_rows} erros
            </span>
            <Button variant="outline" onClick={() => setReportId(b.id)}>
              Relatório
            </Button>
            {b.status !== "concluido" && (
              <Button disabled={busy} onClick={() => void run(b.id)}>
                Retomar pendentes / erros
              </Button>
            )}
          </div>
        ))}
      </Card>
      {reportId && (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="font-semibold">Relatório completo do lote</h2>
          {report.isError && <QueryError retry={report.refetch} />}
          <Button
            variant="outline"
            disabled={!report.data}
            onClick={() =>
              void exportToExcel(
                "resultado-importacao",
                (report.data ?? []).map((r) => ({
                  linha: r.row_number,
                  resultado: r.result,
                  mensagem: r.message,
                  dados: JSON.stringify(r.payload),
                })),
              ).catch((e) => toast.error(String(e)))
            }
          >
            Baixar todas as linhas
          </Button>
          <p>{report.data?.filter((r) => r.result === "erro").length ?? 0} erros neste lote.</p>
          {report.data
            ?.filter((r) => r.result === "erro")
            .map((r) => (
              <p key={r.id}>
                Linha {r.row_number}: {r.message}
              </p>
            ))}
        </Card>
      )}
    </div>
  );
}
