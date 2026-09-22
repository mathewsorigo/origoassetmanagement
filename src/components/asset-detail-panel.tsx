import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSignature,
  Pencil,
  Trash2,
  Undo2,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { AssetIcon, SourceBadge } from "@/components/asset-visual";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
import {
  assetStatusLabel,
  assetTypeLabel,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/format";
import { renderAgreement } from "@/lib/agreements";
import { logAudit } from "@/lib/audit";
import { deleteAssetCascade } from "@/lib/entity-delete";
import { enviarParaAssinatura } from "@/lib/assinatura.functions";

type Employee = { id: string; full_name: string; email: string };

const emptyForm = {
  asset_type: "notebook",
  status: "disponivel",
  brand: "",
  model: "",
  serial_number: "",
  patrimony: "",
  imei: "",
  supplier: "",
  contract_number: "",
  location: "",
  condition: "",
  monthly_cost: "",
  lease_start: "",
  lease_end: "",
  notes: "",
};

type FormState = typeof emptyForm;

export function AssetDetailPanel({
  assetId,
  onOpenChange,
  onNavigate,
  initialMode = "view",
}: {
  assetId: string | null;
  onOpenChange: (open: boolean) => void;
  onNavigate?: ((direction: -1 | 1) => void) | undefined;
  initialMode?: "view" | "edit";
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const enviar = useServerFn(enviarParaAssinatura);
  const open = !!assetId;

  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [dirty, setDirty] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [returnCondition, setReturnCondition] = useState("");
  const [assignForm, setAssignForm] = useState({
    employee_id: "",
    assigned_at: new Date().toISOString().slice(0, 10),
    delivery_condition: "Novo / em perfeito estado",
  });

  useEffect(() => {
    if (assetId) setMode(initialMode);
  }, [assetId, initialMode]);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", assetId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["asset-history", assetId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, employee:employees(id,full_name,email), agreements(id,status,signed_at)")
        .eq("asset_id", assetId!)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-simple"],
    enabled: open,
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

  useEffect(() => {
    if (!asset) return;
    setForm({
      asset_type: asset.asset_type ?? "notebook",
      status: asset.status ?? "disponivel",
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serial_number: asset.serial_number ?? "",
      patrimony: asset.patrimony ?? "",
      imei: asset.imei ?? "",
      supplier: asset.supplier ?? "",
      contract_number: asset.contract_number ?? "",
      location: asset.location ?? "",
      condition: asset.condition ?? "",
      monthly_cost: asset.monthly_cost != null ? String(asset.monthly_cost) : "",
      lease_start: asset.lease_start ? String(asset.lease_start).slice(0, 10) : "",
      lease_end: asset.lease_end ? String(asset.lease_end).slice(0, 10) : "",
      notes: asset.notes ?? "",
    });
    setDirty(false);
  }, [asset]);

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

  const active = (history ?? []).find((h) => h.status === "ativo");
  const activeEmployee = (active?.employee as Employee | null) ?? null;
  const activeAgreement = (active?.agreements as Array<{ id: string; status: string }> | null)?.[0];

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!assetId) return;
      if (!form.serial_number.trim()) throw new Error("Informe o número de série.");
      const { error } = await supabase
        .from("assets")
        .update({
          asset_type: form.asset_type as "notebook",
          status: form.status as "disponivel",
          brand: form.brand || null,
          model: form.model || null,
          serial_number: form.serial_number.trim(),
          patrimony: form.patrimony || null,
          imei: form.imei || null,
          supplier: form.supplier || null,
          contract_number: form.contract_number || null,
          location: form.location || null,
          condition: form.condition || null,
          monthly_cost: form.monthly_cost ? Number(form.monthly_cost) : null,
          lease_start: form.lease_start || null,
          lease_end: form.lease_end || null,
          notes: form.notes || null,
        })
        .eq("id", assetId);
      if (error) throw error;
      await logAudit({
        action: "atualizar",
        entity: "assets",
        entityId: assetId,
        details: { serial_number: form.serial_number },
      });
    },
    onSuccess: () => {
      toast.success("Ativo atualizado.");
      setDirty(false);
      setMode("view");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!assetId) return;
      await deleteAssetCascade(assetId, { serial_number: asset?.serial_number });
    },
    onSuccess: () => {
      toast.success("Ativo excluído.");
      setDeleteOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const employee = employees?.find((e) => e.id === assignForm.employee_id);
      if (!employee || !asset) throw new Error("Selecione o colaborador.");

      const { data: assignment, error } = await supabase
        .from("assignments")
        .insert({
          employee_id: employee.id,
          asset_id: asset.id,
          assigned_at: new Date(assignForm.assigned_at).toISOString(),
          delivery_condition: assignForm.delivery_condition || null,
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
          deliveryDate: assignForm.assigned_at,
          deliveryCondition: assignForm.delivery_condition,
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
      setAssignOpen(false);
      setAssignForm({ ...assignForm, employee_id: "" });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAssignment = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Nenhum vínculo ativo.");
      const { error } = await supabase
        .from("assignments")
        .update({
          status: "encerrado",
          returned_at: new Date().toISOString(),
          return_condition: returnCondition || null,
        })
        .eq("id", active.id);
      if (error) throw error;
      await supabase.from("assets").update({ status: "disponivel" }).eq("id", assetId!);
      await logAudit({ action: "devolver", entity: "assignments", entityId: active.id });
    },
    onSuccess: () => {
      toast.success("Devolução registrada.");
      setReturnOpen(false);
      setReturnCondition("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: "manutencao" | "disponivel") => {
      const { error } = await supabase.from("assets").update({ status }).eq("id", assetId!);
      if (error) throw error;
      await logAudit({
        action: "atualizar",
        entity: "assets",
        entityId: assetId!,
        details: { status },
      });
    },
    onSuccess: () => {
      toast.success("Situação atualizada.");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (agreementId: string) => enviar({ data: { agreementId } }),
    onSuccess: (res) => {
      if (res.mode === "enviado") toast.success(res.message);
      else if (res.mode === "manual") toast.info(res.message);
      else toast.error(res.message);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const title = asset
    ? `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number
    : "Ativo";

  const actionClass = "h-auto w-full justify-start whitespace-normal py-2 text-left";
  const editing = mode === "edit" && canEdit;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-[880px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full flex-col">
            <div className="grid min-h-0 flex-1 md:grid-cols-[292px_1fr]">
              {/* Coluna lateral */}
              <aside className="overflow-y-auto border-b bg-muted/30 px-5 py-6 md:border-b-0 md:border-r">
                <div className="flex flex-col items-center text-center">
                  <AssetIcon type={asset?.asset_type ?? "outro"} size="lg" />
                  {isLoading && !asset ? (
                    <Skeleton className="mt-4 h-6 w-40" />
                  ) : (
                    <h2 className="mt-4 w-full truncate font-display text-lg font-semibold tracking-tight">
                      {title}
                    </h2>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Série {asset?.serial_number ?? "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {asset && <StatusBadge value={asset.status} />}
                    <Badge variant="outline">{assetTypeLabel[asset?.asset_type ?? ""] ?? "—"}</Badge>
                    {asset?.supplier && <Badge variant="secondary">{asset.supplier}</Badge>}
                    <SourceBadge intuneDeviceId={asset?.intune_device_id} />
                  </div>
                </div>

                {canEdit && (
                  <div className="mt-6 space-y-2">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ações
                    </p>
                    <Button
                      className={actionClass}
                      disabled={!!active}
                      onClick={() => setAssignOpen(true)}
                    >
                      <UserPlus className="mr-2 size-4 shrink-0" /> Vincular a uma pessoa
                    </Button>
                    <Button
                      variant="outline"
                      className={actionClass}
                      disabled={!active}
                      onClick={() => setReturnOpen(true)}
                    >
                      <Undo2 className="mr-2 size-4 shrink-0" /> Registrar devolução
                    </Button>
                    <Button
                      variant="outline"
                      className={actionClass}
                      disabled={
                        !activeAgreement || activeAgreement.status === "assinado" || send.isPending
                      }
                      onClick={() => activeAgreement && send.mutate(activeAgreement.id)}
                    >
                      <FileSignature className="mr-2 size-4 shrink-0" /> Enviar termo para assinatura
                    </Button>
                    {asset?.status === "manutencao" ? (
                      <Button
                        variant="outline"
                        className={actionClass}
                        onClick={() => changeStatus.mutate("disponivel")}
                      >
                        <Wrench className="mr-2 size-4 shrink-0" /> Voltar para disponível
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className={actionClass}
                        disabled={!!active}
                        onClick={() => changeStatus.mutate("manutencao")}
                      >
                        <Wrench className="mr-2 size-4 shrink-0" /> Marcar em manutenção
                      </Button>
                    )}

                    <div className="flex gap-2 pt-2">
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
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-2">
                  {onNavigate && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Ativo anterior"
                        onClick={() => onNavigate(-1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Próximo ativo"
                        onClick={() => onNavigate(1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  )}
                  {asset && (
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link to="/ativos/$id" params={{ id: asset.id }}>
                        Ficha completa <ExternalLink className="ml-2 size-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </aside>

              {/* Conteúdo */}
              <div className="min-h-0 overflow-y-auto px-6 py-6">
                <Tabs defaultValue="detalhes">
                  <TabsList>
                    <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                    <TabsTrigger value="uso">Uso</TabsTrigger>
                    <TabsTrigger value="documentos">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="detalhes" className="mt-5 space-y-4 animate-in fade-in-50">
                    {!canEdit && (
                      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                        Você tem acesso somente de consulta.
                      </p>
                    )}

                    {!editing ? (
                      <>
                        <DetailSection title="Hardware">
                          <DetailField
                            label="Tipo"
                            value={assetTypeLabel[asset?.asset_type ?? ""] ?? "—"}
                          />
                          <DetailField label="Situação" value={assetStatusLabel[form.status]} />
                          <DetailField label="Marca" value={form.brand} />
                          <DetailField label="Modelo" value={form.model} />
                          <DetailField label="Condição" value={form.condition} />
                          <DetailField label="Localidade" value={form.location} />
                        </DetailSection>

                        <DetailSection title="Identificação">
                          <DetailField label="Número de série" value={form.serial_number} />
                          <DetailField label="Patrimônio" value={form.patrimony} />
                          <DetailField label="IMEI" value={form.imei} />
                          <DetailField label="ID no Intune" value={asset?.intune_device_id} />
                        </DetailSection>

                        <DetailSection title="Contrato">
                          <DetailField label="Fornecedor" value={form.supplier} />
                          <DetailField label="Contrato" value={form.contract_number} />
                          <DetailField
                            label="Custo mensal"
                            value={asset?.monthly_cost != null ? formatMoney(asset.monthly_cost) : ""}
                          />
                          <DetailField label="Início da locação" value={formatDate(form.lease_start)} />
                          <DetailField label="Fim da locação" value={formatDate(form.lease_end)} />
                        </DetailSection>

                        <DetailSection title="Gestão" columns={1}>
                          <DetailField label="Usuário atual" value={activeEmployee?.full_name} />
                          <DetailField
                            label="Última verificação no Intune"
                            value={formatDateTime(asset?.intune_last_sync)}
                          />
                          <DetailField label="Cadastrado em" value={formatDate(asset?.created_at)} />
                          <DetailField label="Observações" value={form.notes} />
                        </DetailSection>
                      </>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select
                            value={form.asset_type}
                            onValueChange={(v) => set("asset_type", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(assetTypeLabel).map(([v, l]) => (
                                <SelectItem key={v} value={v}>
                                  {l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Situação</Label>
                          <Select value={form.status} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(assetStatusLabel).map(([v, l]) => (
                                <SelectItem key={v} value={v}>
                                  {l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(
                          [
                            ["brand", "Marca"],
                            ["model", "Modelo"],
                            ["serial_number", "Número de série"],
                            ["patrimony", "Patrimônio"],
                            ["imei", "IMEI"],
                            ["supplier", "Fornecedor"],
                            ["contract_number", "Contrato"],
                            ["location", "Localidade"],
                            ["condition", "Condição"],
                            ["monthly_cost", "Custo mensal (R$)"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="space-y-2">
                            <Label>{label}</Label>
                            <Input
                              value={form[key]}
                              inputMode={key === "monthly_cost" ? "decimal" : undefined}
                              onChange={(e) => set(key, e.target.value)}
                            />
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label>Início da locação</Label>
                          <Input
                            type="date"
                            value={form.lease_start}
                            onChange={(e) => set("lease_start", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fim da locação</Label>
                          <Input
                            type="date"
                            value={form.lease_end}
                            onChange={(e) => set("lease_end", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={form.notes}
                            onChange={(e) => set("notes", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="uso" className="mt-5 space-y-4 animate-in fade-in-50">
                    <section className="rounded-xl border bg-card p-4">
                      <h3 className="font-display text-sm font-semibold">Usuário atual</h3>
                      {activeEmployee ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Link
                              to="/pessoas/$id"
                              params={{ id: activeEmployee.id }}
                              className="text-sm font-medium hover:text-primary hover:underline"
                            >
                              {activeEmployee.full_name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{activeEmployee.email}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Entrega {formatDate(active?.assigned_at)}
                            </p>
                          </div>
                          {activeAgreement && <StatusBadge value={activeAgreement.status} />}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Equipamento sem usuário vinculado.
                        </p>
                      )}
                    </section>

                    <section className="rounded-xl border bg-card p-4">
                      <h3 className="font-display text-sm font-semibold">Histórico de uso</h3>
                      <div className="mt-3 space-y-2">
                        {(history ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Este ativo ainda não foi vinculado.
                          </p>
                        )}
                        {(history ?? []).map((h) => {
                          const employee = h.employee as Employee | null;
                          const agreement = (
                            h.agreements as Array<{ id: string; status: string }> | null
                          )?.[0];
                          return (
                            <div
                              key={h.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                            >
                              <div>
                                <p className="text-sm font-medium">{employee?.full_name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Entrega {formatDate(h.assigned_at)}
                                  {h.returned_at
                                    ? ` · Devolução ${formatDate(h.returned_at)}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {agreement && <StatusBadge value={agreement.status} />}
                                <StatusBadge value={h.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="documentos" className="mt-5 animate-in fade-in-50">
                    {assetId && <DocumentsPanel filter={{ assetId }} />}
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
            <AlertDialogTitle className="font-display">Excluir equipamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {title} · série {asset?.serial_number ?? "—"}. O histórico de vínculos, termos e
              documentos deste equipamento também serão apagados. Esta ação não pode ser desfeita.
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

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Vincular equipamento</DialogTitle>
            <DialogDescription>
              O termo de responsabilidade é gerado automaticamente com os dados do colaborador e do
              equipamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={assignForm.employee_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}
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
              <Label>Data de entrega</Label>
              <Input
                type="date"
                value={assignForm.assigned_at}
                onChange={(e) => setAssignForm({ ...assignForm, assigned_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Condição de entrega</Label>
              <Input
                value={assignForm.delivery_condition}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, delivery_condition: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createAssignment.mutate()} disabled={createAssignment.isPending}>
              Vincular e gerar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar devolução</DialogTitle>
            <DialogDescription>
              O vínculo é encerrado e o equipamento volta para disponível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Condição de devolução</Label>
            <Textarea
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
              placeholder="Ex.: equipamento em bom estado, com carregador."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => closeAssignment.mutate()} disabled={closeAssignment.isPending}>
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
