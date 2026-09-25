import { ChecklistFields, emptyChecklist } from "@/components/assignment-checklist";
import { parseMoney, validatePeriod } from "@/lib/validation";
import { QueryError } from "@/components/query-error";
import { useEffect, useMemo, useState, useRef } from "react";
import { Timeline, type TimelineEvent } from "@/components/timeline";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSignature,
  Pencil,
  Tags,
  Trash2,
  Undo2,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { AssetIcon, SourceBadge } from "@/components/asset-visual";
import { modelImage } from "@/lib/model-images";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { DetailField, DetailSection } from "@/components/detail-field";
import { TagBadge } from "@/components/tag-badge";
import { AssetQrButton } from "@/components/asset-qr-dialog";
import { TagPicker } from "@/components/tag-picker";
import { useAssetTags } from "@/lib/tags";
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
import {
  localCalendarDate,
  uploadChecklistPhotos,
  assertChecklist,
} from "@/lib/assignment-workflow";
import { fetchAll } from "@/lib/fetch-all";
import { logAudit } from "@/lib/audit";
import { archiveAsset } from "@/lib/entity-delete";
import { enviarParaAssinatura } from "@/lib/assinatura.functions";
import { BitdefenderStatus } from "@/components/bitdefender-status";
import { Switch } from "@/components/ui/switch";

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
  last_seen_location: "",
  bitdefender_installed: false,
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
  const baseVersion = useRef<string | null>(null);
  const [deliveryChecks, setDeliveryChecks] = useState(emptyChecklist());
  const [deliveryPhotos, setDeliveryPhotos] = useState<File[]>([]);
  const [returnChecks, setReturnChecks] = useState(emptyChecklist());
  const [returnPhotos, setReturnPhotos] = useState<File[]>([]);
  const [dirty, setDirty] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [returnCondition, setReturnCondition] = useState("");
  const [assignForm, setAssignForm] = useState({
    employee_id: "",
    assignment_kind: "physical_delivery" as "physical_delivery" | "administrative",
    create_agreement: false,
    assigned_at: localCalendarDate(),
    delivery_condition: "Novo / em perfeito estado",
  });

  useEffect(() => {
    if (assetId) setMode(initialMode);
  }, [assetId, initialMode]);

  const {
    data: asset,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

  const {
    data: history,
    isError: historyError,
    refetch: retryHistory,
  } = useQuery({
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

  const { data: assetTagMap } = useAssetTags();
  const tags = assetId ? (assetTagMap?.get(assetId) ?? []) : [];

  const { data: activity } = useQuery({
    queryKey: ["asset-activity", assetId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,details,created_at,actor_email")
        .eq("entity", "assets")
        .eq("entity_id", assetId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    for (const h of history ?? []) {
      const row = h as unknown as {
        id: string;
        assigned_at: string | null;
        returned_at: string | null;
        employee: { full_name: string | null } | null;
        agreements: Array<{ id: string; status: string; signed_at: string | null }> | null;
      };
      const who = row.employee?.full_name ?? "colaborador";
      if (row.assigned_at)
        events.push({
          id: `a-${row.id}`,
          at: row.assigned_at,
          kind: "vinculo",
          title: `Vinculado a ${who}`,
        });
      if (row.returned_at)
        events.push({
          id: `d-${row.id}`,
          at: row.returned_at,
          kind: "devolucao",
          title: `Devolvido por ${who}`,
        });
      for (const ag of row.agreements ?? []) {
        if (ag.signed_at)
          events.push({
            id: `s-${ag.id}`,
            at: ag.signed_at,
            kind: "assinatura",
            title: "Termo de responsabilidade assinado",
            description: who,
          });
      }
    }
    for (const item of activity ?? []) {
      const row = item as unknown as {
        id: string;
        action: string;
        created_at: string;
        actor_email: string | null;
      };
      events.push({
        id: `l-${row.id}`,
        at: row.created_at,
        kind: row.action.includes("criar") ? "criacao" : "alteracao",
        title: row.action.replace(/_/g, " "),
        by: row.actor_email || "Sistema",
      });
    }
    return events;
  }, [history, activity]);

  const { data: employees } = useQuery({
    queryKey: ["employees-assignment-policy"],
    enabled: open,
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

  useEffect(() => {
    if (!asset || dirty) return;
    baseVersion.current = asset.updated_at;
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
      last_seen_location: asset.last_seen_location ?? "",
      bitdefender_installed: asset.bitdefender_installed ?? false,
      condition: asset.condition ?? "",
      monthly_cost: asset.monthly_cost != null ? String(asset.monthly_cost) : "",
      lease_start: asset.lease_start ? String(asset.lease_start).slice(0, 10) : "",
      lease_end: asset.lease_end ? String(asset.lease_end).slice(0, 10) : "",
      notes: asset.notes ?? "",
    });
    setDirty(false);
  }, [asset, dirty]);

  useEffect(() => {
    if (!open || !onNavigate || dirty) return;
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
  }, [open, onNavigate, dirty]);

  const active = (history ?? []).find((h) => h.status === "ativo");
  const activeEmployee = (active?.employee as Employee | null) ?? null;
  const activeAgreement = (active?.agreements as Array<{ id: string; status: string }> | null)?.[0];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!assetId) return;
      if (asset?.updated_at !== baseVersion.current)
        throw new Error(
          "Este ativo foi atualizado por outra pessoa. Reabra a ficha antes de salvar para comparar as alterações.",
        );
      validatePeriod(form.lease_start, form.lease_end);
      if (!form.serial_number.trim()) throw new Error("Informe o número de série.");
      const { data: saved, error } = await supabase
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
          last_seen_location: form.last_seen_location || null,
          bitdefender_installed: form.bitdefender_installed,
          condition: form.condition || null,
          monthly_cost: parseMoney(form.monthly_cost),
          lease_start: form.lease_start || null,
          lease_end: form.lease_end || null,
          notes: form.notes || null,
        })
        .eq("id", assetId)
        .eq("updated_at", baseVersion.current!)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!saved) throw new Error("O ativo mudou durante a edição. Atualize a ficha.");
      await logAudit({
        action: "atualizar",
        entity: "assets",
        entityId: assetId,
        details: { antes: asset, depois: saved },
      });
    },
    onSuccess: () => {
      toast.success("Ativo atualizado.");
      setDirty(false);
      setMode("view");
      queryClient.invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!assetId) return;
      await archiveAsset(assetId, !!asset?.archived_at);
    },
    onSuccess: () => {
      toast.success(asset?.archived_at ? "Cadastro restaurado." : "Cadastro arquivado.");
      setDeleteOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const employee = employees?.find((e) => e.id === assignForm.employee_id);
      if (!employee || !asset) throw new Error("Selecione o colaborador.");

      if (!assignForm.assigned_at) throw new Error("Informe a data da entrega.");
      const { data: template, error: templateError } = assignForm.create_agreement ? await supabase
        .from("agreement_templates")
        .select("id,body")
        .eq("is_default", true)
        .maybeSingle() : { data: null, error: null };
      if (templateError) throw templateError;
      if (assignForm.create_agreement && !template)
        throw new Error("Configure um modelo de termo padrão antes de registrar a entrega.");
      assertChecklist(deliveryChecks);
      const deliveryId = crypto.randomUUID();
      const uploaded = await uploadChecklistPhotos(deliveryId, deliveryPhotos);
      const { error } = await supabase.rpc("create_assignment_complete", {
        p_id: deliveryId,
        p_employee_id: employee.id,
        p_asset_id: asset.id,
        p_assigned_at: new Date(assignForm.assigned_at + "T00:00:00").toISOString(),
        p_delivery_condition: assignForm.delivery_condition,
        p_notes: "",
        p_template_id: template?.id ?? null,
        p_create_agreement: assignForm.create_agreement,
        p_assignment_kind: assignForm.assignment_kind,
        p_content: template ? renderAgreement(template.body, employee, asset, {
          deliveryDate: assignForm.assigned_at,
          deliveryCondition: assignForm.delivery_condition,
        }) : null,
        p_items: deliveryChecks,
        p_photos: uploaded,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo criado e termo de uso gerado.");
      setAssignOpen(false);
      setDeliveryChecks(emptyChecklist());
      setDeliveryPhotos([]);
      setAssignForm({ ...assignForm, create_agreement: false, employee_id: "" });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAssignment = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Nenhum vínculo ativo.");
      assertChecklist(returnChecks);
      const uploaded = await uploadChecklistPhotos(active.id, returnPhotos);
      const { error } = await supabase.rpc("close_assignment_complete", {
        p_id: active.id,
        p_condition: returnCondition,
        p_items: returnChecks,
        p_photos: uploaded,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução registrada.");
      setReturnOpen(false);
      setReturnChecks(emptyChecklist());
      setReturnPhotos([]);
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
          if (!v && (!dirty || window.confirm("Descartar alterações não salvas?"))) {
            setDirty(false);
            onOpenChange(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 bg-white p-0 sm:max-w-[880px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full flex-col">
            {dirty && (
              <div role="status" className="flex items-center gap-3 border-b p-2 text-sm">
                Rascunho local preservado.
                <Button variant="outline" size="sm" onClick={() => setDirty(false)}>
                  Descartar e recarregar
                </Button>
              </div>
            )}
            {isError && <QueryError retry={refetch} />}
            {historyError && <QueryError retry={retryHistory} />}
            {dirty && asset?.updated_at !== baseVersion.current && (
              <p role="alert" className="p-3 text-sm text-destructive">
                Este registro mudou em outra sessão. Descarte e recarregue para comparar antes de
                salvar.
              </p>
            )}
            <div className="grid min-h-0 flex-1 md:grid-cols-[292px_1fr]">
              {/* Coluna lateral */}
              <aside className="overflow-y-auto border-b bg-white px-5 py-6 md:border-b-0 md:border-r">
                <div className="flex flex-col items-center text-center">
                  <AssetIcon
                    type={asset?.asset_type ?? "outro"}
                    model={asset?.model}
                    size="lg"
                    className={modelImage(asset?.model) ? "size-32 rounded-2xl" : undefined}
                  />
                  {isLoading && !asset ? (
                    <Skeleton className="mt-4 h-6 w-40" />
                  ) : (
                    <div className="mt-4 flex w-full min-w-0 items-center justify-center gap-1.5">
                      <h2 className="truncate font-display text-lg font-semibold tracking-tight">
                        {title}
                      </h2>
                      <BitdefenderStatus installed={asset?.bitdefender_installed} />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Série {asset?.serial_number ?? "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {asset && <StatusBadge value={asset.status} />}
                    <Badge variant="outline">
                      {assetTypeLabel[asset?.asset_type ?? ""] ?? "—"}
                    </Badge>
                    {asset?.supplier && <Badge variant="secondary">{asset.supplier}</Badge>}
                    <SourceBadge intuneDeviceId={asset?.intune_device_id} />
                  </div>

                  <div className="mt-4 w-full rounded-xl border bg-card/70 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Etiquetas
                      </p>
                      {canEdit && (
                        <button
                          type="button"
                          className="text-xs text-primary underline-offset-4 hover:underline"
                          onClick={() => setTagsOpen(true)}
                        >
                          editar
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem etiquetas</span>
                      ) : (
                        tags.map((tag) => <TagBadge key={tag.id} tag={tag} />)
                      )}
                    </div>
                  </div>
                </div>

                {asset && (
                  <div className="mt-6">
                    <AssetQrButton asset={asset} className={actionClass} />
                  </div>
                )}

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
                      <FileSignature className="mr-2 size-4 shrink-0" /> Enviar termo para
                      assinatura
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
                        <Trash2 className="mr-2 size-3.5" />{" "}
                        {asset?.archived_at ? "Restaurar" : "Arquivar"}
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
                        disabled={dirty}
                        onClick={() => onNavigate(-1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Próximo ativo"
                        disabled={dirty}
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
                    <TabsTrigger value="atividade">Linha do tempo</TabsTrigger>
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
                          <DetailField
                            label="Última localidade vista"
                            value={form.last_seen_location}
                          />
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
                            value={
                              asset?.monthly_cost != null ? formatMoney(asset.monthly_cost) : ""
                            }
                          />
                          <DetailField
                            label="Início da locação"
                            value={formatDate(form.lease_start)}
                          />
                          <DetailField label="Fim da locação" value={formatDate(form.lease_end)} />
                        </DetailSection>

                        <DetailSection title="Gestão" columns={1}>
                          <DetailField label="Usuário atual" value={activeEmployee?.full_name} />
                          <DetailField
                            label="Último check-in no Intune"
                            value={formatDateTime(asset?.intune_last_sync)}
                          />
                          <DetailField
                            label="Cadastrado em"
                            value={formatDate(asset?.created_at)}
                          />
                          <DetailField label="Observações" value={form.notes} />
                        </DetailSection>
                      </>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={"qa-assetdetailpaneltsx-28640-"}>Tipo</Label>
                          <Select
                            value={form.asset_type}
                            onValueChange={(v) => set("asset_type", v)}
                          >
                            <SelectTrigger id={"qa-assetdetailpaneltsx-28640-"}>
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
                          <Label htmlFor={"qa-assetdetailpaneltsx-29476-"}>Situação</Label>
                          <Select value={form.status} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger id={"qa-assetdetailpaneltsx-29476-"}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(assetStatusLabel)
                                .filter(([v]) => (active ? v === "em_uso" : v !== "em_uso"))
                                .map(([v, l]) => (
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
                            ["last_seen_location", "Última localidade vista"],
                            ["condition", "Condição"],
                            ["monthly_cost", "Custo mensal (R$)"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="space-y-2">
                            <Label
                              htmlFor={
                                "qa-assetdetailpaneltsx-31081-" + encodeURIComponent(String(label))
                              }
                            >
                              {label}
                            </Label>
                            <Input
                              id={
                                "qa-assetdetailpaneltsx-31081-" + encodeURIComponent(String(label))
                              }
                              value={form[key]}
                              inputMode={key === "monthly_cost" ? "decimal" : undefined}
                              onChange={(e) => set(key, e.target.value)}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
                          <div>
                            <Label htmlFor="bitdefender-installed">Bitdefender instalado</Label>
                            <p className="text-xs text-muted-foreground">
                              Estado detectado no último sincronismo.
                            </p>
                          </div>
                          <Switch
                            id="bitdefender-installed"
                            checked={form.bitdefender_installed}
                            onCheckedChange={(checked) => set("bitdefender_installed", checked)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={"qa-assetdetailpaneltsx-32287-"}>Início da locação</Label>
                          <Input
                            id={"qa-assetdetailpaneltsx-32287-"}
                            type="date"
                            value={form.lease_start}
                            onChange={(e) => set("lease_start", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={"qa-assetdetailpaneltsx-32665-"}>Fim da locação</Label>
                          <Input
                            id={"qa-assetdetailpaneltsx-32665-"}
                            type="date"
                            value={form.lease_end}
                            onChange={(e) => set("lease_end", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor={"qa-assetdetailpaneltsx-33050-"}>Observações</Label>
                          <Textarea
                            id={"qa-assetdetailpaneltsx-33050-"}
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
                                  {h.returned_at ? ` · Devolução ${formatDate(h.returned_at)}` : ""}
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

                  <TabsContent value="atividade" className="mt-5 animate-in fade-in-50">
                    <Timeline events={timelineEvents} />
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
            <AlertDialogTitle className="font-display">
              {asset?.archived_at ? "Restaurar" : "Arquivar"} equipamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {title} · série {asset?.serial_number ?? "—"}. O histórico, os termos e os documentos
              serão preservados. O cadastro poderá ser restaurado.
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
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Vincular equipamento</DialogTitle>
            <DialogDescription>
              Termo opcional, somente em rascunho. Vínculo administrativo não comprova posse ou entrega física.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={"qa-assetdetailpaneltsx-39537-"}>Colaborador</Label>
              <label className="block space-y-2">Tipo de vínculo
                <select className="block w-full rounded border p-2" value={assignForm.assignment_kind}
                  onChange={(e) => setAssignForm({ ...assignForm, create_agreement: false, employee_id: "", assignment_kind: e.target.value as "physical_delivery" | "administrative" })}>
                  <option value="physical_delivery">Entrega física (somente ativos)</option>
                  <option value="administrative">Administrativo (ativos e inativos; sem reativação)</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={assignForm.create_agreement} onChange={(e) => setAssignForm({ ...assignForm, create_agreement: e.target.checked })} />
                Criar termo em rascunho (opcional; não envia)
              </label>
              <Select
                value={assignForm.employee_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}
              >
                <SelectTrigger id={"qa-assetdetailpaneltsx-39537-"}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).filter((e) => assignForm.assignment_kind === "administrative" || e.status === "ativo").map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}{e.status === "inativo" ? " (inativo)" : ""} — {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-assetdetailpaneltsx-40233-"}>Data de entrega</Label>
              <Input
                id={"qa-assetdetailpaneltsx-40233-"}
                type="date"
                value={assignForm.assigned_at}
                onChange={(e) => setAssignForm({ ...assignForm, assigned_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-assetdetailpaneltsx-40546-"}>Condição de entrega</Label>
              <Input
                id={"qa-assetdetailpaneltsx-40546-"}
                value={assignForm.delivery_condition}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, delivery_condition: e.target.value })
                }
              />
            </div>
          </div>
          <ChecklistFields
            items={deliveryChecks}
            onChange={setDeliveryChecks}
            photos={deliveryPhotos}
            onPhotos={setDeliveryPhotos}
          />
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
            <Label htmlFor={"qa-assetdetailpaneltsx-41791-"}>Condição de devolução</Label>
            <Textarea
              id={"qa-assetdetailpaneltsx-41791-"}
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
              placeholder="Ex.: equipamento em bom estado, com carregador."
            />
          </div>
          <ChecklistFields
            items={returnChecks}
            onChange={setReturnChecks}
            photos={returnPhotos}
            onPhotos={setReturnPhotos}
          />
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

      <TagPicker assetIds={assetId ? [assetId] : []} open={tagsOpen} onOpenChange={setTagsOpen} />
    </>
  );
}
