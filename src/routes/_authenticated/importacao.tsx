import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import { exportToExcel, readSpreadsheet } from "@/lib/excel";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({
    meta: [
      { title: "Importação · Órigo Ativos" },
      {
        name: "description",
        content: "Subida em massa de ativos e colaboradores por planilha Excel ou CSV.",
      },
      { property: "og:title", content: "Importação · Órigo Ativos" },
      { property: "og:description", content: "Importe série e modelo dos equipamentos por planilha." },
    ],
  }),
  component: Importacao,
});

const assetHeaders = [
  "tipo",
  "marca",
  "modelo",
  "serial",
  "patrimonio",
  "imei",
  "fornecedor",
  "contrato",
  "custo_mensal",
  "inicio_locacao",
  "fim_locacao",
  "localidade",
];
const employeeHeaders = ["nome", "email", "cpf", "cargo", "area", "unidade", "gestor", "telefone"];

const typeMap: Record<string, string> = {
  notebook: "notebook",
  laptop: "notebook",
  celular: "celular",
  smartphone: "celular",
  telefone: "celular",
  monitor: "monitor",
  acessorio: "acessorio",
  outro: "outro",
};

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of Object.keys(row)) {
    const norm = key
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    if (keys.includes(norm)) {
      const value = row[key];
      if (value === null || value === undefined || value === "") continue;
      return String(value).trim();
    }
  }
  return "";
}

function toDate(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000) {
    const date = new Date(Date.UTC(1899, 11, 30) as unknown as number);
    date.setUTCDate(date.getUTCDate() + serial);
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function Importacao() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [kind, setKind] = useState("ativos");
  const [file, setFile] = useState<File | null>(null);

  const { data: batches } = useQuery({
    queryKey: ["import-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione a planilha.");
      const rows = await readSpreadsheet(await file.arrayBuffer());
      if (rows.length === 0) throw new Error("A planilha está vazia.");

      const { data: batch, error: batchError } = await supabase
        .from("import_batches")
        .insert({
          kind,
          file_name: file.name,
          total_rows: rows.length,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      let created = 0;
      let updated = 0;
      let failed = 0;
      const rowLogs: Array<{
        batch_id: string;
        row_number: number;
        payload: Record<string, unknown>;
        result: string;
        message: string | null;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const lineNumber = i + 2;
        try {
          if (kind === "ativos") {
            const serial = pick(row, ["serial", "serie", "numero_de_serie", "serial_number", "n_serie"]);
            if (!serial) throw new Error("Número de série não informado.");
            const rawType = pick(row, ["tipo", "tipo_de_ativo", "categoria"]).toLowerCase();
            const payload = {
              serial_number: serial,
              asset_type: (typeMap[rawType] ?? "notebook") as "notebook",
              brand: pick(row, ["marca", "fabricante"]) || null,
              model: pick(row, ["modelo", "model"]) || null,
              patrimony: pick(row, ["patrimonio", "patrimonio_n", "ativo_fixo"]) || null,
              imei: pick(row, ["imei"]) || null,
              supplier: pick(row, ["fornecedor", "locadora"]) || "Simpress",
              contract_number: pick(row, ["contrato", "contrato_numero"]) || null,
              location: pick(row, ["localidade", "local", "unidade"]) || null,
              monthly_cost: Number(
                pick(row, ["custo_mensal", "valor_mensal", "custo"]).replace(",", "."),
              ) || null,
              lease_start: toDate(pick(row, ["inicio_locacao", "inicio", "data_inicio"])),
              lease_end: toDate(pick(row, ["fim_locacao", "fim", "data_fim", "vencimento"])),
            };
            const { data: existing } = await supabase
              .from("assets")
              .select("id")
              .eq("serial_number", serial)
              .maybeSingle();
            if (existing) {
              const { error } = await supabase.from("assets").update(payload).eq("id", existing.id);
              if (error) throw error;
              updated++;
              rowLogs.push({
                batch_id: batch.id,
                row_number: lineNumber,
                payload: row,
                result: "atualizado",
                message: null,
              });
            } else {
              const { error } = await supabase.from("assets").insert(payload);
              if (error) throw error;
              created++;
              rowLogs.push({
                batch_id: batch.id,
                row_number: lineNumber,
                payload: row,
                result: "criado",
                message: null,
              });
            }
          } else {
            const email = pick(row, ["email", "e_mail", "email_corporativo"]).toLowerCase();
            const name = pick(row, ["nome", "nome_completo", "colaborador"]);
            if (!email || !name) throw new Error("Nome e e-mail são obrigatórios.");
            const payload = {
              full_name: name,
              email,
              cpf: pick(row, ["cpf"]) || null,
              phone: pick(row, ["telefone", "celular", "fone"]) || null,
              job_title: pick(row, ["cargo", "funcao"]) || null,
              department: pick(row, ["area", "departamento", "setor"]) || null,
              unit: pick(row, ["unidade", "filial", "local"]) || null,
              manager_name: pick(row, ["gestor", "lider", "responsavel"]) || null,
            };
            const { data: existing } = await supabase
              .from("employees")
              .select("id")
              .eq("email", email)
              .maybeSingle();
            if (existing) {
              const { error } = await supabase
                .from("employees")
                .update(payload)
                .eq("id", existing.id);
              if (error) throw error;
              updated++;
              rowLogs.push({
                batch_id: batch.id,
                row_number: lineNumber,
                payload: row,
                result: "atualizado",
                message: null,
              });
            } else {
              const { error } = await supabase.from("employees").insert(payload);
              if (error) throw error;
              created++;
              rowLogs.push({
                batch_id: batch.id,
                row_number: lineNumber,
                payload: row,
                result: "criado",
                message: null,
              });
            }
          }
        } catch (err) {
          failed++;
          rowLogs.push({
            batch_id: batch.id,
            row_number: lineNumber,
            payload: row,
            result: "erro",
            message: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      }

      if (rowLogs.length) {
        await supabase.from("import_rows").insert(rowLogs as never);
      }
      await supabase
        .from("import_batches")
        .update({ created_rows: created, updated_rows: updated, failed_rows: failed })
        .eq("id", batch.id);
      await logAudit({
        action: "importar_planilha",
        entity: "import_batches",
        entityId: batch.id,
        details: { kind, created, updated, failed },
      });

      return { created, updated, failed, batchId: batch.id };
    },
    onSuccess: (res) => {
      toast.success(
        `Importação concluída: ${res.created} criados, ${res.updated} atualizados, ${res.failed} com erro.`,
      );
      setFile(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: lastErrors } = useQuery({
    queryKey: ["import-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_rows")
        .select("*")
        .eq("result", "erro")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Importação por planilha"
        description="Suba os dados da Simpress, do Easy ou de qualquer planilha com série e modelo."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              exportToExcel(
                kind === "ativos" ? "modelo-ativos" : "modelo-colaboradores",
                [
                  Object.fromEntries(
                    (kind === "ativos" ? assetHeaders : employeeHeaders).map((h) => [h, ""]),
                  ),
                ],
              )
            }
          >
            <Download className="mr-2 size-4" /> Baixar modelo
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Nova importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>O que você vai importar</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos (notebooks e celulares)</SelectItem>
                  <SelectItem value="colaboradores">Colaboradores</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Planilha (.xlsx ou .csv)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Colunas reconhecidas:{" "}
                {(kind === "ativos" ? assetHeaders : employeeHeaders).join(", ")}. Registros
                existentes são atualizados pela {kind === "ativos" ? "série" : "e-mail"}.
              </p>
            </div>
            <Button onClick={() => run.mutate()} disabled={run.isPending || !file}>
              <Upload className="mr-2 size-4" />
              {run.isPending ? "Importando…" : "Importar planilha"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <FileSpreadsheet className="size-4 text-primary" /> Últimas importações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(batches ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma importação realizada.</p>
            )}
            {(batches ?? []).map((b) => (
              <div key={b.id} className="rounded-lg border p-3">
                <p className="truncate text-sm font-medium">{b.file_name ?? b.kind}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(b.created_at)}</p>
                <p className="mt-1 text-xs">
                  <span className="text-success">{b.created_rows} criados</span> ·{" "}
                  <span className="text-info">{b.updated_rows} atualizados</span> ·{" "}
                  <span className="text-destructive">{b.failed_rows} erros</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <CardTitle className="mb-3 font-display text-base">Linhas com erro</CardTitle>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linha</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Dados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lastErrors ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum erro registrado.
                  </TableCell>
                </TableRow>
              )}
              {(lastErrors ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.row_number}</TableCell>
                  <TableCell className="text-sm text-destructive">{r.message}</TableCell>
                  <TableCell className="max-w-96 truncate text-xs text-muted-foreground">
                    {JSON.stringify(r.payload)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
