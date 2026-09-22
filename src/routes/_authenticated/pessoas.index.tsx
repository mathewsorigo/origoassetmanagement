import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  UserSearch,
  Download,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmployeeDetailPanel } from "@/components/employee-detail-panel";
import { RowActions } from "@/components/row-actions";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToCsv } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteEmployeeCascade } from "@/lib/entity-delete";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
import { employeeStatusLabel } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { exportToExcel } from "@/lib/excel";

export const Route = createFileRoute("/_authenticated/pessoas/")({
  head: () => ({
    meta: [
      { title: "Colaboradores · Órigo Ativos" },
      {
        name: "description",
        content: "Cadastro de colaboradores da Órigo Energia e equipamentos em uso por cada um.",
      },
      { property: "og:title", content: "Colaboradores · Órigo Ativos" },
      { property: "og:description", content: "Quem usa qual equipamento na Órigo Energia." },
    ],
  }),
  component: Pessoas,
});

const emptyForm = {
  full_name: "",
  email: "",
  cpf: "",
  phone: "",
  job_title: "",
  department: "",
  unit: "",
  manager_name: "",
  status: "ativo",
};

function Pessoas() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkDelete, setBulkDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, assignments(id,status,asset:assets(serial_number,brand,model))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.email.trim())
        throw new Error("Nome e e-mail são obrigatórios.");
      const { data, error } = await supabase
        .from("employees")
        .insert({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          cpf: form.cpf || null,
          phone: form.phone || null,
          job_title: form.job_title || null,
          department: form.department || null,
          unit: form.unit || null,
          manager_name: form.manager_name || null,
          status: form.status as "ativo",
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        action: "criar",
        entity: "employees",
        entityId: data.id,
        details: { email: form.email },
      });
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado.");
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmployee = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      await deleteEmployeeCascade(deleteTarget.id, { email: deleteTarget.email });
    },
    onSuccess: () => {
      toast.success("Colaborador excluído.");
      if (deleteTarget?.id === selectedId) setSelectedId(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return employees ?? [];
    return (employees ?? []).filter((e) =>
      [e.full_name, e.email, e.department, e.job_title, e.unit]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [employees, term]);

  function activeAssets(row: (typeof filtered)[number]) {
    return (
      (row.assignments as Array<{
        status: string;
        asset: { serial_number: string; brand: string | null; model: string | null } | null;
      }> | null) ?? []
    ).filter((a) => a.status === "ativo");
  }

  const allChecked = filtered.length > 0 && filtered.every((e) => checked.has(e.id));
  const selectedEmployees = filtered.filter((e) => checked.has(e.id));

  function toggleRow(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(filtered.map((e) => e.id)));
  }

  function rowsToExport(list: typeof filtered) {
    return list.map((e) => ({
      Nome: e.full_name,
      "E-mail": e.email,
      CPF: e.cpf,
      Cargo: e.job_title,
      Área: e.department,
      Unidade: e.unit,
      Gestor: e.manager_name,
      Situação: employeeStatusLabel[e.status],
      "Equipamentos em uso": activeAssets(e).length,
    }));
  }

  const removeSelected = useMutation({
    mutationFn: async () => {
      for (const employee of selectedEmployees) {
        await deleteEmployeeCascade(employee.id, { email: employee.email });
      }
    },
    onSuccess: () => {
      toast.success("Colaboradores excluídos.");
      setChecked(new Set());
      setBulkDelete(false);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description="Cadastro das pessoas que utilizam os equipamentos da Órigo."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 size-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => exportToExcel("colaboradores", rowsToExport(filtered))}
                >
                  <FileSpreadsheet className="mr-2 size-4" /> Planilha XLSX
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportToCsv("colaboradores", rowsToExport(filtered))}
                >
                  <Download className="mr-2 size-4" /> Arquivo CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 size-4" /> Novo colaborador
              </Button>
            )}
          </>
        }
      />


      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, e-mail, área…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "colaborador" : "colaboradores"}
        </div>

        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Área / Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Equipamentos em uso</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-primary">
                        <UserSearch className="size-6" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-semibold">
                          Nenhum colaborador encontrado
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ajuste a busca ou cadastre uma nova pessoa.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((e, index) => {
                const selected = selectedId === e.id;
                return (
                  <TableRow
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    className={cn(
                      "cursor-pointer animate-in fade-in-0 slide-in-from-bottom-1 transition-colors",
                      selected && "bg-primary/[0.07] hover:bg-primary/10",
                    )}
                  >
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox
                        checked={checked.has(e.id)}
                        onCheckedChange={() => toggleRow(e.id)}
                        aria-label="Selecionar colaborador"
                      />
                    </TableCell>
                    <TableCell>
                      <p
                        className={cn(
                          "font-medium transition-colors",
                          selected && "text-primary",
                        )}
                      >
                        {e.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.department ?? "—"}
                      <p className="text-xs text-muted-foreground">{e.job_title ?? ""}</p>
                    </TableCell>
                    <TableCell className="text-sm">{e.unit ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {activeAssets(e).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        activeAssets(e).map((a, i) => (
                          <p key={i} className="text-xs">
                            {a.asset?.brand} {a.asset?.model} · {a.asset?.serial_number}
                          </p>
                        ))
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={e.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                      {canEdit && (
                        <RowActions
                          onEdit={() => {
                            setPanelMode("edit");
                            setSelectedId(e.id);
                          }}
                          onDelete={() =>
                            setDeleteTarget({ id: e.id, name: e.full_name, email: e.email })
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <BulkActionBar
        count={checked.size}
        total={filtered.length}
        noun="colaboradores"
        onClear={() => setChecked(new Set())}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportToExcel("colaboradores-selecionados", rowsToExport(selectedEmployees))
          }
        >
          <FileSpreadsheet className="mr-1.5 size-4" /> Exportar
        </Button>
        {canEdit && (
          <Button size="sm" variant="destructive" onClick={() => setBulkDelete(true)}>
            <Trash2 className="mr-1.5 size-4" /> Excluir
          </Button>
        )}
      </BulkActionBar>

      <AlertDialog open={bulkDelete} onOpenChange={setBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Excluir {checked.size} colaboradores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os vínculos, termos e documentos dessas pessoas também serão apagados. Quem tem
              equipamento em uso precisa da devolução registrada antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSelected.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                removeSelected.mutate();
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} · {deleteTarget?.email}. O histórico de vínculos, termos e
              documentos desta pessoa também serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeEmployee.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                removeEmployee.mutate();
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmployeeDetailPanel
        employeeId={selectedId}
        initialMode={panelMode}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedId(null);
            setPanelMode("view");
          }
        }}
        onNavigate={(dir) => {
          const i = filtered.findIndex((e) => e.id === selectedId);
          if (i < 0) return;
          const next = filtered[i + dir];
          if (next) setSelectedId(next.id);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Novo colaborador</DialogTitle>
            <DialogDescription>
              Os dados aqui preenchem automaticamente o termo de uso do equipamento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["full_name", "Nome completo *"],
                ["email", "E-mail corporativo *"],
                ["cpf", "CPF"],
                ["phone", "Telefone"],
                ["job_title", "Cargo"],
                ["department", "Área"],
                ["unit", "Unidade"],
                ["manager_name", "Gestor"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(ev) => setForm({ ...form, [key]: ev.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(employeeStatusLabel).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Salvar colaborador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
