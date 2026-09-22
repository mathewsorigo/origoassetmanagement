import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Upload, Eye, Loader2 } from "lucide-react";
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

  const { data: agreements, isLoading } = useQuery({
    queryKey: ["agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select(
          "*, employee:employees(id,full_name,email), asset:assets(id,serial_number,brand,model)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const table = useTableState(agreements, {
    key: "termos",
    accessors: {
      colaborador: (a) => (a.employee as { full_name: string } | null)?.full_name ?? null,
      equipamento: (a) => {
        const asset = a.asset as { brand: string | null; model: string | null; serial_number: string } | null;
        return asset ? `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number : null;
      },
      envio: (a) => a.sent_at,
      assinatura: (a) => a.signed_at,
      situacao: (a) => a.status,
    },
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
      const path = `termos/${agreement.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("asset-documents")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: docError } = await supabase.from("documents").insert({
        agreement_id: agreement.id,
        employee_id: agreement.employee_id,
        asset_id: agreement.asset_id,
        kind: "termo_assinado",
        file_name: file.name,
        storage_path: path,
        uploaded_by: user?.id ?? null,
      });
      if (docError) throw docError;

      const { error: updateError } = await supabase
        .from("agreements")
        .update({
          status: "assinado",
          signed_at: new Date().toISOString(),
          signed_document_path: path,
        })
        .eq("id", agreement.id);
      if (updateError) throw updateError;

      await logAudit({ action: "anexar_termo_assinado", entity: "agreements", entityId: agreement.id });
    },
    onSuccess: () => {
      toast.success("Documento assinado anexado ao histórico.");
      setUploadTarget(null);
      setFile(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Termos de uso"
        description="Cada vínculo gera um termo preenchido. Envie para assinatura e o documento assinado fica no histórico."
      />

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
            {!isLoading && table.total === 0 && (
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
    </div>
  );
}
