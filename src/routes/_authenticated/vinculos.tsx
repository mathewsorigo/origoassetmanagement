import { assertChecklist } from "@/lib/assignment-workflow";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate } from "@/lib/format";
import { renderAgreement } from "@/lib/agreements";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useRemoteList } from "@/hooks/useRemoteList";
import { QueryError } from "@/components/query-error";
import { uploadChecklistPhotos, localCalendarDate } from "@/lib/assignment-workflow";
import { fetchAll } from "@/lib/fetch-all";
import {
  ChecklistFields,
  emptyChecklist,
  type ChecklistItem,
} from "@/components/assignment-checklist";

export const Route = createFileRoute("/_authenticated/vinculos")({
  head: () => ({
    meta: [
      { title: "Vínculos · Órigo Ativos" },
      {
        name: "description",
        content:
          "Vincule equipamentos com termo opcional.",
      },
      { property: "og:title", content: "Vínculos · Órigo Ativos" },
      {
        property: "og:description",
        content: "Vínculos físicos e administrativos com termo opcional.",
      },
    ],
  }),
  component: Vinculos,
});

function Vinculos() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [open, setOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(emptyChecklist());
  const [checklistPhotos, setChecklistPhotos] = useState<File[]>([]);
  const [returnChecklist, setReturnChecklist] = useState<ChecklistItem[]>(emptyChecklist());
  const [returnPhotos, setReturnPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    employee_id: "",
    assignment_kind: "physical_delivery" as "physical_delivery" | "administrative",
    create_agreement: false,
    asset_id: "",
    assigned_at: localCalendarDate(),
    delivery_condition: "Novo / em perfeito estado",
    notes: "",
  });

  const [nameQuery, setNameQuery] = useState("");
  const list = useRemoteList({
    view: "assignments_list",
    key: "assignments",
    term: nameQuery,
    defaultSort: "entrega",
    defaultSortDir: "desc",
    columns: {
      colaborador: "employee_name",
      equipamento: "asset_name",
      entrega: "assigned_at",
      devolucao: "returned_at",
      situacao: "status",
    },
  });
  const { isLoading, table } = list;

  const { data: employees } = useQuery({
    queryKey: ["employees-assignment-policy"],
    queryFn: async () => {
      return fetchAll((from, to) =>
        supabase
          .from("employees")
          .select("id,full_name,email,cpf,job_title,department,status")
          .is("archived_at", null)
          .order("full_name")
          .order("id")
          .range(from, to),
      );
    },
  });

  const { data: availableAssets } = useQuery({
    queryKey: ["assets-available"],
    queryFn: async () => {
      return fetchAll((from, to) =>
        supabase
          .from("assets")
          .select("id,serial_number,brand,model,asset_type,patrimony,imei,supplier")
          .eq("status", "disponivel")
          .is("archived_at", null)
          .order("serial_number")
          .order("id")
          .range(from, to),
      );
    },
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const employee = employees?.find((e) => e.id === form.employee_id);
      const asset = availableAssets?.find((a) => a.id === form.asset_id);
      if (!employee || !asset) throw new Error("Selecione o colaborador e o equipamento.");

      if (!form.assigned_at) throw new Error("Informe a data da entrega.");
      const { data: template, error: templateError } = form.create_agreement ? await supabase
        .from("agreement_templates")
        .select("id,body")
        .eq("is_default", true)
        .maybeSingle() : { data: null, error: null };
      if (templateError) throw templateError;
      if (form.create_agreement && !template)
        throw new Error("Configure um modelo de termo padrão antes de registrar a entrega.");
      const id = crypto.randomUUID();
      assertChecklist(checklist);
      const photos = await uploadChecklistPhotos(id, checklistPhotos);
      const { error } = await supabase.rpc("create_assignment_complete", {
        p_id: id,
        p_asset_id: asset.id,
        p_employee_id: employee.id,
        p_assigned_at: new Date(form.assigned_at + "T00:00:00").toISOString(),
        p_delivery_condition: form.delivery_condition,
        p_notes: form.notes,
        p_template_id: template?.id ?? null,
        p_create_agreement: form.create_agreement,
        p_assignment_kind: form.assignment_kind,
        p_content: template ? renderAgreement(template.body, employee, asset, {
          deliveryDate: form.assigned_at,
          deliveryCondition: form.delivery_condition,
        }) : null,
        p_items: checklist,
        p_photos: photos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo e checklist registrados.");
      setOpen(false);
      setForm({ ...form, create_agreement: false, employee_id: "", asset_id: "", notes: "" });
      setChecklist(emptyChecklist());
      setChecklistPhotos([]);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      assertChecklist(returnChecklist);
      const photos = await uploadChecklistPhotos(assignmentId, returnPhotos);
      const { error } = await supabase.rpc("close_assignment_complete", {
        p_id: assignmentId,
        p_condition: returnCondition,
        p_items: returnChecklist,
        p_photos: photos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução registrada com checklist.");
      setReturnTarget(null);
      setReturnCondition("");
      setReturnChecklist(emptyChecklist());
      setReturnPhotos([]);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Vínculos"
        title="Vínculos"
        description="Vínculos físicos e administrativos. Termo opcional, sem envio automático."
        actions={
          canEdit ? (
            <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> Novo vínculo
            </Button>
          ) : undefined
        }
      />

      {list.isError && <QueryError retry={list.refetch} />}
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={nameQuery}
              onChange={(e) => {
                setNameQuery(e.target.value);
                table.setPage(1);
              }}
              placeholder="Buscar nome, equipamento ou série…"
              aria-label="Buscar vínculo por nome, equipamento ou série"
              className="h-10 pl-9 pr-9"
            />
            {nameQuery && (
              <button
                type="button"
                onClick={() => setNameQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {nameQuery && (
            <span className="text-xs text-muted-foreground">
              {table.total} {table.total === 1 ? "vínculo encontrado" : "vínculos encontrados"}
            </span>
          )}
        </div>

        <ul className="divide-y md:hidden">
          {isLoading && (
            <li className="py-6 text-center text-sm text-muted-foreground">Carregando…</li>
          )}
          {!isLoading && !list.isError && table.total === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {nameQuery
                ? "Nenhum vínculo encontrado para essa busca."
                : "Nenhum vínculo registrado."}
            </li>
          )}
          {table.pageRows.map((a) => {
            const employee = a.employee as { id: string; full_name: string } | null;
            const asset = a.asset as {
              id: string;
              serial_number: string;
              brand: string | null;
              model: string | null;
            } | null;
            const agreement = (a.agreements as Array<{ id: string; status: string }> | null)?.[0];
            return (
              <li key={a.id} className="min-w-0 space-y-2 py-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  {employee ? (
                    <Link
                      to="/pessoas/$id"
                      params={{ id: employee.id }}
                      className="min-w-0 break-words font-medium hover:text-primary"
                    >
                      {employee.full_name}
                    </Link>
                  ) : (
                    <span />
                  )}
                  <div className="shrink-0">
                    <StatusBadge value={a.status} />
                  </div>
                </div>
                {asset && (
                  <Link
                    to="/ativos/$id"
                    params={{ id: asset.id }}
                    className="block break-words text-sm text-muted-foreground hover:text-primary"
                  >
                    {asset.brand} {asset.model} · {asset.serial_number}
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Entrega: {formatDate(a.assigned_at)}</span>
                  {a.returned_at && <span>Devolução: {formatDate(a.returned_at)}</span>}
                  {agreement ? (
                    <Link to="/termos">
                      <StatusBadge value={agreement.status} />
                    </Link>
                  ) : (
                    <span>sem termo</span>
                  )}
                </div>
                {canEdit && a.status === "ativo" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setReturnTarget(a.id)}
                  >
                    <Undo2 className="mr-2 size-4" /> Devolver
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {(
                  [
                    ["colaborador", "Colaborador"],
                    ["equipamento", "Equipamento"],
                    ["entrega", "Entrega"],
                    ["devolucao", "Devolução"],
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
                <TableHead>Termo</TableHead>
                <SortableHead
                  columnKey="situacao"
                  label="Situação"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onToggle={table.toggleSort}
                />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && table.total === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum vínculo registrado.
                  </TableCell>
                </TableRow>
              )}
              {table.pageRows.map((a) => {
                const employee = a.employee as { id: string; full_name: string } | null;
                const asset = a.asset as {
                  id: string;
                  serial_number: string;
                  brand: string | null;
                  model: string | null;
                } | null;
                const agreement = (
                  a.agreements as Array<{ id: string; status: string }> | null
                )?.[0];
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">
                      {employee && (
                        <Link
                          to="/pessoas/$id"
                          params={{ id: employee.id }}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {employee.full_name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {asset && (
                        <Link
                          to="/ativos/$id"
                          params={{ id: asset.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {asset.brand} {asset.model} · {asset.serial_number}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(a.assigned_at)}</TableCell>
                    <TableCell className="text-sm">
                      {a.returned_at ? formatDate(a.returned_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {agreement ? (
                        <Link to="/termos" className="text-xs text-primary hover:underline">
                          <StatusBadge value={agreement.status} />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem termo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={a.status} />
                    </TableCell>
                    <TableCell>
                      {canEdit && a.status === "ativo" && (
                        <Button variant="ghost" size="sm" onClick={() => setReturnTarget(a.id)}>
                          <Undo2 className="mr-2 size-4" /> Devolver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="vínculos"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Novo vínculo</DialogTitle>
            <DialogDescription>
              Termo opcional, somente em rascunho. Vínculo administrativo não comprova posse ou entrega física.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-17294-"}>Colaborador</Label>
              <label className="block space-y-2">Tipo de vínculo
                <select className="block w-full rounded border p-2" value={form.assignment_kind}
                  onChange={(e) => setForm({ ...form, create_agreement: false, employee_id: "", assignment_kind: e.target.value as "physical_delivery" | "administrative" })}>
                  <option value="physical_delivery">Entrega física (somente ativos)</option>
                  <option value="administrative">Administrativo (ativos e inativos; sem reativação)</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.create_agreement} onChange={(e) => setForm({ ...form, create_agreement: e.target.checked })} />
                Criar termo em rascunho (opcional; não envia)
              </label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
                <SelectTrigger id={"qa-vinculostsx-17294-"}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).filter((e) => form.assignment_kind === "administrative" || e.status === "ativo").map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}{e.status === "inativo" ? " (inativo)" : ""} — {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-17972-"}>Equipamento disponível</Label>
              <Select
                value={form.asset_id}
                onValueChange={(v) => setForm({ ...form, asset_id: v })}
              >
                <SelectTrigger id={"qa-vinculostsx-17972-"}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(availableAssets ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.brand} {a.model} · {a.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(availableAssets ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum equipamento com situação "Disponível".
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-18896-"}>Data de entrega</Label>
              <Input
                id={"qa-vinculostsx-18896-"}
                type="date"
                value={form.assigned_at}
                onChange={(e) => setForm({ ...form, assigned_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-19191-"}>Condição de entrega</Label>
              <Input
                id={"qa-vinculostsx-19191-"}
                value={form.delivery_condition}
                onChange={(e) => setForm({ ...form, delivery_condition: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-19476-"}>Observações</Label>
              <Textarea
                id={"qa-vinculostsx-19476-"}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <ChecklistFields
              items={checklist}
              onChange={setChecklist}
              photos={checklistPhotos}
              onPhotos={setChecklistPhotos}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createAssignment.mutate()} disabled={createAssignment.isPending}>
              Vincular e gerar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnTarget} onOpenChange={(v) => !v && setReturnTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar devolução</DialogTitle>
            <DialogDescription>O equipamento volta para a situação "Disponível".</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={"qa-vinculostsx-20721-"}>Condição na devolução</Label>
              <Textarea
                id={"qa-vinculostsx-20721-"}
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                placeholder="Ex.: equipamento em bom estado, com carregador"
              />
            </div>
            <ChecklistFields
              items={returnChecklist}
              onChange={setReturnChecklist}
              photos={returnPhotos}
              onPhotos={setReturnPhotos}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => returnTarget && closeAssignment.mutate(returnTarget)}
              disabled={closeAssignment.isPending}
            >
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
