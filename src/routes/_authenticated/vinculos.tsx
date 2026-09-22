import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
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
import { logAudit } from "@/lib/audit";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";

export const Route = createFileRoute("/_authenticated/vinculos")({
  head: () => ({
    meta: [
      { title: "Vínculos · Órigo Ativos" },
      {
        name: "description",
        content:
          "Vincule equipamentos a colaboradores; o termo de uso é gerado automaticamente na entrega.",
      },
      { property: "og:title", content: "Vínculos · Órigo Ativos" },
      {
        property: "og:description",
        content: "Entregas e devoluções de equipamentos com termo automático.",
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
  const [form, setForm] = useState({
    employee_id: "",
    asset_id: "",
    assigned_at: new Date().toISOString().slice(0, 10),
    delivery_condition: "Novo / em perfeito estado",
    notes: "",
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "*, employee:employees(id,full_name,email), asset:assets(id,serial_number,brand,model), agreements(id,status)",
        )
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const table = useTableState(assignments, {
    key: "vinculos",
    accessors: {
      colaborador: (a) => (a.employee as { full_name: string } | null)?.full_name ?? null,
      equipamento: (a) => {
        const asset = a.asset as { brand: string | null; model: string | null; serial_number: string } | null;
        return asset ? `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number : null;
      },
      entrega: (a) => a.assigned_at,
      devolucao: (a) => a.returned_at,
      situacao: (a) => a.status,
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,full_name,email,cpf,job_title,department")
        .eq("status", "ativo")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availableAssets } = useQuery({
    queryKey: ["assets-available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id,serial_number,brand,model,asset_type,patrimony,imei,supplier")
        .eq("status", "disponivel")
        .order("serial_number");
      if (error) throw error;
      return data;
    },
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const employee = employees?.find((e) => e.id === form.employee_id);
      const asset = availableAssets?.find((a) => a.id === form.asset_id);
      if (!employee || !asset) throw new Error("Selecione o colaborador e o equipamento.");

      const { data: assignment, error } = await supabase
        .from("assignments")
        .insert({
          employee_id: employee.id,
          asset_id: asset.id,
          assigned_at: new Date(form.assigned_at).toISOString(),
          delivery_condition: form.delivery_condition || null,
          notes: form.notes || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("assets").update({ status: "em_uso" }).eq("id", asset.id);

      const { data: template } = await supabase
        .from("agreement_templates")
        .select("id,body")
        .eq("is_default", true)
        .maybeSingle();

      if (template) {
        const content = renderAgreement(template.body, employee, asset, {
          deliveryDate: form.assigned_at,
          deliveryCondition: form.delivery_condition,
        });
        const { error: agreementError } = await supabase.from("agreements").insert({
          assignment_id: assignment.id,
          employee_id: employee.id,
          asset_id: asset.id,
          template_id: template.id,
          content,
          status: "rascunho",
        });
        if (agreementError) throw agreementError;
      }

      await logAudit({
        action: "vincular",
        entity: "assignments",
        entityId: assignment.id,
        details: { employee: employee.email, serial_number: asset.serial_number },
      });
    },
    onSuccess: () => {
      toast.success("Vínculo criado e termo de uso gerado.");
      setOpen(false);
      setForm({ ...form, employee_id: "", asset_id: "", notes: "" });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const row = assignments?.find((a) => a.id === assignmentId);
      const { error } = await supabase
        .from("assignments")
        .update({
          status: "encerrado",
          returned_at: new Date().toISOString(),
          return_condition: returnCondition || null,
        })
        .eq("id", assignmentId);
      if (error) throw error;
      const assetId = (row?.asset as { id: string } | null)?.id;
      if (assetId) await supabase.from("assets").update({ status: "disponivel" }).eq("id", assetId);
      await logAudit({ action: "devolver", entity: "assignments", entityId: assignmentId });
    },
    onSuccess: () => {
      toast.success("Devolução registrada.");
      setReturnTarget(null);
      setReturnCondition("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Vínculos"
        description="Entregas e devoluções. Ao vincular, o termo de uso é preenchido automaticamente."
        actions={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> Novo vínculo
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-x-auto p-4">
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
              const agreement = (a.agreements as Array<{ id: string; status: string }> | null)?.[0];
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
              O termo de responsabilidade é gerado automaticamente com os dados do colaborador e do
              equipamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} — {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipamento disponível</Label>
              <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                <SelectTrigger>
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
              <Label>Data de entrega</Label>
              <Input
                type="date"
                value={form.assigned_at}
                onChange={(e) => setForm({ ...form, assigned_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Condição de entrega</Label>
              <Input
                value={form.delivery_condition}
                onChange={(e) => setForm({ ...form, delivery_condition: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
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
            <DialogDescription>
              O equipamento volta para a situação "Disponível".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Condição na devolução</Label>
            <Textarea
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
              placeholder="Ex.: equipamento em bom estado, com carregador"
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
