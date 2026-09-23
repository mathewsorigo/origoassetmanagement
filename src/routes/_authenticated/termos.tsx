import { useRemoteList } from "@/hooks/useRemoteList";
import { fetchAll } from "@/lib/fetch-all";
import { QueryError } from "@/components/query-error";
import { reconcileAgreementDispatch } from "@/lib/assinatura.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Upload, Eye, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { openDocument } from "@/components/documents-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession, isOperator } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { enviarParaAssinatura } from "@/lib/assinatura.functions";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";

export const Route = createFileRoute("/_authenticated/termos")({
  head: () => ({
    meta: [
      { title: "Termos · Órigo Ativos" },
      {
        name: "description",
        content:
          "Termos de responsabilidade gerados automaticamente, envio para assinatura e documentos assinados.",
      },
      { property: "og:title", content: "Termos · Órigo Ativos" },
      {
        property: "og:description",
        content: "Assinatura eletrônica dos termos de uso de equipamento.",
      },
    ],
  }),
  component: Termos,
});

function Termos() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const enviar = useServerFn(enviarParaAssinatura);
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [term, setTerm] = useState("");
  const list = useRemoteList({
    view: "agreements_list",
    key: "agreements",
    term,
    defaultSort: "created_at",
    defaultSortDir: "desc",
    columns: {
      colaborador: "employee_name",
      equipamento: "asset_name",
      envio: "sent_at",
      assinatura: "signed_at",
      situacao: "status",
      created_at: "created_at",
    },
  });
  const { rows: agreements, isLoading, table } = list;
  const stats = useQuery({
    queryKey: ["agreements-stats"],
    queryFn: async () => {
      const r = await supabase.from("agreement_statistics").select("*").single();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const signedTotal = stats.data?.signed ?? 0,
    pendingTotal = stats.data?.pending ?? 0;
  const signedPct =
    signedTotal + pendingTotal > 0
      ? Math.round((signedTotal / (signedTotal + pendingTotal)) * 100)
      : null;
  const reconcile = useServerFn(reconcileAgreementDispatch);
  const [resolveId, setResolveId] = useState<string | null>(null),
    [envelope, setEnvelope] = useState("");
  const resolve = useMutation({
    mutationFn: () => reconcile({ data: { agreementId: resolveId!, envelopeId: envelope } }),
    onSuccess: () => {
      setResolveId(null);
      setEnvelope("");
      void queryClient.invalidateQueries();
      toast.success("Envio conciliado com o envelope informado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: async () => {
      const { data: settings, error: settingsError } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "termos")
        .maybeSingle();
      if (settingsError) throw settingsError;
      const value = (settings?.value ?? {}) as Record<string, unknown>;
      if (value["lembrete_ativo"] === false)
        throw new Error("Os lembretes estão desativados nas preferências de Termos.");
      const prazo = Number(value["lembrete_dias"]) > 0 ? Number(value["lembrete_dias"]) : 3;
      const cutoff = new Date(Date.now() - prazo * 24 * 60 * 60 * 1000).toISOString();
      const overdue = await fetchAll((from, to) =>
        supabase
          .from("agreements")
          .select("id")
          .in("status", ["rascunho", "enviado", "visualizado"])
          .or("and(sent_at.is.null,created_at.lt." + cutoff + "),sent_at.lt." + cutoff)
          .order("id")
          .range(from, to),
      );
      if (overdue.length === 0) return { count: 0, prazo };
      const { error } = await supabase.from("agreement_reminders").insert(
        overdue.map((a) => ({
          agreement_id: a.id,
          sent_by: user?.id ?? null,
          note: `Cobrança registrada após ${prazo} dias sem assinatura`,
        })),
      );
      if (error) throw error;
      await logAudit({
        action: "cobrar_termos",
        entity: "agreements",
        details: { total: overdue.length, prazo_dias: prazo },
      });
      return { count: overdue.length, prazo };
    },
    onSuccess: ({ count, prazo }) => {
      if (count === 0) toast.info(`Nenhum termo pendente além de ${prazo} dias.`);
      else
        toast.success(
          `${count} cobrança(s) registrada(s) na linha do tempo e na auditoria. O envio do e-mail/Docusign segue pelo hermes-agent.`,
        );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (agreementId: string) => enviar({ data: { agreementId } }),
    onSuccess: (res) => {
      if (res.mode === "enviado") toast.success(res.message);
      else if (res.mode === "manual") toast.info(res.message);
      else toast.error(res.message);
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!uploadTarget || !file) throw new Error("Selecione o arquivo assinado.");
      const agreement = agreements?.find((a) => a.id === uploadTarget);
      if (!agreement) throw new Error("Termo não encontrado.");
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const path = `termos/${agreement.id}/${hash}-${file.name.replace(/[^\w.-]+/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("asset-documents")
        .upload(path, file, { upsert: false });
      if (
        uploadError &&
        !["409", "Duplicate"].includes(
          String((uploadError as { statusCode?: string }).statusCode),
        ) &&
        !/already exists/i.test(uploadError.message)
      )
        throw uploadError;

      const { error } = await supabase.rpc("qa_transaction", {
        p_action: "attach_signed",
        p_data: { id: agreement.id, name: file.name, path },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento assinado anexado ao histórico.");
      setUploadTarget(null);
      setFile(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (list.isError || stats.isError)
    return (
      <QueryError
        retry={() => {
          void list.refetch();
          void stats.refetch();
        }}
      />
    );
  return (
    <div>
      <Input
        aria-label="Buscar termos"
        placeholder="Buscar por colaborador ou série"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <PageHeader
        breadcrumb="Termos de uso"
        title="Termos de uso"
        description="Cada vínculo gera um termo preenchido. Envie para assinatura e o documento assinado fica no histórico."
        actions={
          canEdit ? (
            <Button variant="outline" onClick={() => remind.mutate()} disabled={remind.isPending}>
              {remind.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 size-4" />
              )}
              Cobrar pendentes
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm">
          Cobertura documental: {stats.data?.covered ?? 0} de {stats.data?.active ?? 0} vínculos
          ativos possuem termo.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="font-semibold tabular-nums text-success">{signedTotal}</span>{" "}
              <span className="text-muted-foreground">assinados</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums text-warning">{pendingTotal}</span>{" "}
              <span className="text-muted-foreground">pendentes</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                {signedPct === null ? "Sem dados" : signedPct + "%"}
              </span>{" "}
              <span className="text-muted-foreground">dos termos emitidos assinados</span>
            </span>
          </div>
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted sm:max-w-xs">
            <div
              className="h-full rounded-full bg-success transition-all duration-700"
              style={{ width: `${signedPct ?? 0}%` }}
            />
          </div>
        </div>
      </Card>

      {agreements
        .filter((a) => ["processando", "incerto"].includes(a.dispatch_state ?? ""))
        .map((a) => (
          <div className="my-2 rounded border p-3" key={a.id}>
            <p>
              Envio aguardando conferência: {a.dispatch_error ?? "Solicitação em processamento"}
            </p>
            <Button variant="outline" onClick={() => setResolveId(a.id)}>
              Conciliar envelope confirmado
            </Button>
          </div>
        ))}
      <Card className="overflow-x-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ["colaborador", "Colaborador"],
                  ["equipamento", "Equipamento"],
                  ["envio", "Envio"],
                  ["assinatura", "Assinatura"],
                  ["situacao", "Situação"],
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !list.isError && table.total === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum termo gerado. Crie um vínculo em Vínculos.
                </TableCell>
              </TableRow>
            )}
            {table.pageRows.map((a) => {
              const employee = a.employee as { full_name: string; email: string } | null;
              const asset = a.asset as {
                serial_number: string;
                brand: string | null;
                model: string | null;
              } | null;
              return (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    <p className="font-medium">{employee?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{employee?.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {asset?.brand} {asset?.model}
                    <p className="text-xs text-muted-foreground">{asset?.serial_number}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(a.sent_at)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(a.signed_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={a.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreview({ id: a.id, content: a.content })}
                      >
                        <Eye className="mr-1 size-4" /> Ver
                      </Button>
                      {a.signed_document_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openDocument(a.signed_document_path!).catch((e: Error) =>
                              toast.error(e.message),
                            )
                          }
                        >
                          Assinado
                        </Button>
                      )}
                      {canEdit && a.status !== "assinado" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => send.mutate(a.id)}
                            disabled={send.isPending}
                          >
                            {send.isPending ? (
                              <Loader2 className="mr-1 size-4 animate-spin" />
                            ) : (
                              <Send className="mr-1 size-4" />
                            )}
                            Enviar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setUploadTarget(a.id)}>
                            <Upload className="mr-1 size-4" /> Anexar
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="termos"
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

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Termo de responsabilidade</DialogTitle>
            <DialogDescription>Documento gerado automaticamente pelo sistema.</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
            {preview?.content}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (!preview) return;
                const blob = new Blob([preview.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `termo-${preview.id.slice(0, 8)}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Baixar texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadTarget} onOpenChange={(v) => !v && setUploadTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Anexar termo assinado</DialogTitle>
            <DialogDescription>
              O arquivo fica no histórico do colaborador e do equipamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Arquivo (PDF)</Label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => attach.mutate()} disabled={attach.isPending}>
              Anexar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!resolveId}
        onOpenChange={(open) => {
          if (!open) setResolveId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conciliar envio</DialogTitle>
            <DialogDescription>
              Confira o termo no serviço de assinatura e informe o identificador do envelope
              existente. Esta ação registra a confirmação e não envia outro documento.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Identificador do envelope confirmado"
            value={envelope}
            onChange={(e) => setEnvelope(e.target.value)}
          />
          <Button disabled={!envelope.trim() || resolve.isPending} onClick={() => resolve.mutate()}>
            Confirmar envelope verificado
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
