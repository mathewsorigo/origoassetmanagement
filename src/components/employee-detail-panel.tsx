import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/asset-visual";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { DetailField, DetailSection } from "@/components/detail-field";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
import { employeeStatusLabel, formatDate } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { deleteEmployeeCascade } from "@/lib/entity-delete";

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

type FormState = typeof emptyForm;

export function EmployeeDetailPanel({
  employeeId,
  onOpenChange,
  onNavigate,
  initialMode = "view",
}: {
  employeeId: string | null;
  onOpenChange: (open: boolean) => void;
  onNavigate?: ((direction: -1 | 1) => void) | undefined;
  initialMode?: "view" | "edit";
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const open = !!employeeId;

  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [dirty, setDirty] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (employeeId) setMode(initialMode);
  }, [employeeId, initialMode]);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", employeeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["employee-history", employeeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, asset:assets(id,serial_number,brand,model,asset_type), agreements(id,status)")
        .eq("employee_id", employeeId!)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!employee) return;
    setForm({
      full_name: employee.full_name ?? "",
      email: employee.email ?? "",
      cpf: employee.cpf ?? "",
      phone: employee.phone ?? "",
      job_title: employee.job_title ?? "",
      department: employee.department ?? "",
      unit: employee.unit ?? "",
      manager_name: employee.manager_name ?? "",
      status: employee.status ?? "ativo",
    });
    setDirty(false);
  }, [employee]);

  useEffect(() => {
    if (!open || !onNavigate) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate!(1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate!(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNavigate]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!employeeId) return;
      if (!form.full_name.trim() || !form.email.trim())
        throw new Error("Nome e e-mail são obrigatórios.");
      const { error } = await supabase
        .from("employees")
        .update({
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
        .eq("id", employeeId);
      if (error) throw error;
      await logAudit({
        action: "atualizar",
        entity: "employees",
        entityId: employeeId,
        details: { email: form.email },
      });
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado.");
      setDirty(false);
      setMode("view");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!employeeId) return;
      await deleteEmployeeCascade(employeeId, { email: employee?.email });
    },
    onSuccess: () => {
      toast.success("Colaborador excluído.");
      setDeleteOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (form.full_name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const editing = mode === "edit" && canEdit;
  const activeCount = (history ?? []).filter((h) => h.status === "ativo").length;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-[880px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full flex-col">
            <div className="grid min-h-0 flex-1 md:grid-cols-[292px_1fr]">
              <aside className="overflow-y-auto border-b bg-muted/30 px-5 py-6 md:border-b-0 md:border-r">
                <div className="flex flex-col items-center text-center">
                  <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-display text-lg font-semibold text-primary">
                    {initials}
                  </span>
                  {isLoading && !employee ? (
                    <Skeleton className="mt-4 h-6 w-40" />
                  ) : (
                    <h2 className="mt-4 w-full truncate font-display text-lg font-semibold tracking-tight">
                      {form.full_name || "Colaborador"}
                    </h2>
                  )}
                  <p className="mt-1 w-full truncate text-xs text-muted-foreground">{form.email}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {employee && <StatusBadge value={employee.status} />}
                    {form.department && (
                      <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                        {form.department}
                      </span>
                    )}
                    {form.job_title && (
                      <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                        {form.job_title}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {activeCount === 1
                      ? "1 equipamento em uso"
                      : `${activeCount} equipamentos em uso`}
                  </p>
                </div>

                {canEdit && (
                  <div className="mt-6 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setMode(editing ? "view" : "edit")}
                    >
                      <Pencil className="mr-2 size-3.5" /> {editing ? "Ver dados" : "Editar"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 size-3.5" /> Excluir
                    </Button>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-2">
                  {onNavigate && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Anterior"
                        onClick={() => onNavigate(-1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Próximo"
                        onClick={() => onNavigate(1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  )}
                  {employee && (
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link to="/pessoas/$id" params={{ id: employee.id }}>
                        Ficha completa <ExternalLink className="ml-2 size-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </aside>

              <div className="min-h-0 overflow-y-auto px-6 py-6">
                <Tabs defaultValue="dados">
                  <TabsList>
                    <TabsTrigger value="dados">Detalhes</TabsTrigger>
                    <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
                    <TabsTrigger value="documentos">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="mt-5 space-y-4 animate-in fade-in-50">
                    {!canEdit && (
                      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                        Você tem acesso somente de consulta.
                      </p>
                    )}

                    {!editing ? (
                      <>
                        <DetailSection title="Identificação">
                          <DetailField label="Nome completo" value={form.full_name} />
                          <DetailField label="E-mail corporativo" value={form.email} />
                          <DetailField label="CPF" value={form.cpf} />
                          <DetailField label="Telefone" value={form.phone} />
                        </DetailSection>

                        <DetailSection title="Organização">
                          <DetailField label="Cargo" value={form.job_title} />
                          <DetailField label="Área" value={form.department} />
                          <DetailField label="Unidade" value={form.unit} />
                          <DetailField label="Gestor" value={form.manager_name} />
                          <DetailField
                            label="Situação"
                            value={employeeStatusLabel[form.status] ?? form.status}
                          />
                          <DetailField label="Cadastrado em" value={formatDate(employee?.created_at)} />
                        </DetailSection>
                      </>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(
                          [
                            ["full_name", "Nome completo"],
                            ["email", "E-mail corporativo"],
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
                            <Input value={form[key]} onChange={(e) => set(key, e.target.value)} />
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label>Situação</Label>
                          <Select value={form.status} onValueChange={(v) => set("status", v)}>
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
                    )}
                  </TabsContent>

                  <TabsContent
                    value="equipamentos"
                    className="mt-5 space-y-2 animate-in fade-in-50"
                  >
                    {(history ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum equipamento vinculado a esta pessoa.
                      </p>
                    )}
                    {(history ?? []).map((h) => {
                      const asset = h.asset as {
                        id: string;
                        serial_number: string;
                        brand: string | null;
                        model: string | null;
                        asset_type: string;
                      } | null;
                      const agreement = (
                        h.agreements as Array<{ id: string; status: string }> | null
                      )?.[0];
                      return (
                        <div
                          key={h.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <AssetIcon type={asset?.asset_type ?? "outro"} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {`${asset?.brand ?? ""} ${asset?.model ?? ""}`.trim() ||
                                  asset?.serial_number ||
                                  "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Série {asset?.serial_number ?? "—"} · Entrega{" "}
                                {formatDate(h.assigned_at)}
                                {h.returned_at ? ` · Devolução ${formatDate(h.returned_at)}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {agreement && <StatusBadge value={agreement.status} />}
                            <StatusBadge value={h.status} />
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="documentos" className="mt-5 animate-in fade-in-50">
                    {employeeId && <DocumentsPanel filter={{ employeeId }} />}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {editing && (
              <div className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  {dirty ? "Alterações não salvas" : "Tudo salvo"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMode("view")}>
                    Cancelar
                  </Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
                    Salvar alterações
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {form.full_name || "Colaborador"} · {form.email}. O histórico de vínculos, termos e
              documentos desta pessoa também serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
              disabled={remove.isPending}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
