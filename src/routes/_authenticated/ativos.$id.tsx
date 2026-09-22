import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, FileSignature, Undo2, UserPlus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { AssetIcon, FieldGrid, SourceBadge } from "@/components/asset-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
import { assetTypeLabel, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { renderAgreement } from "@/lib/agreements";
import { logAudit } from "@/lib/audit";
import { enviarParaAssinatura } from "@/lib/assinatura.functions";

export const Route = createFileRoute("/_authenticated/ativos/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do ativo · Órigo Ativos" },
      {
        name: "description",
        content: "Ficha completa do equipamento com histórico de uso e documentos assinados.",
      },
      { property: "og:title", content: "Ficha do ativo · Órigo Ativos" },
      { property: "og:description", content: "Histórico de uso e documentos do equipamento." },
    ],
  }),
  component: AtivoDetalhe,
});

type Employee = { id: string; full_name: string; email: string };

function AtivoDetalhe() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const enviar = useServerFn(enviarParaAssinatura);

  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnCondition, setReturnCondition] = useState("");
  const [assignForm, setAssignForm] = useState({
    employee_id: "",
    assigned_at: new Date().toISOString().slice(0, 10),
    delivery_condition: "Novo / em perfeito estado",
  });

  const { data: asset } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["asset-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, employee:employees(id,full_name,email), agreements(id,status,signed_at)")
        .eq("asset_id", id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
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

  const active = (history ?? []).find((h) => h.status === "ativo");
  const activeEmployee = (active?.employee as Employee | null) ?? null;
  const activeAgreement = (
    active?.agreements as Array<{ id: string; status: string }> | null
  )?.[0];

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
      await supabase.from("assets").update({ status: "disponivel" }).eq("id", id);
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
      const { error } = await supabase.from("assets").update({ status }).eq("id", id);
      if (error) throw error;
      await logAudit({ action: "atualizar", entity: "assets", entityId: id, details: { status } });
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

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/ativos">
          <ArrowLeft className="mr-2 size-4" /> Voltar para ativos
        </Link>
      </Button>

      <div className="mb-5 flex flex-wrap items-start gap-4 rounded-xl border bg-card p-5">
        <AssetIcon type={asset?.asset_type ?? "outro"} model={asset?.model} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {asset && <StatusBadge value={asset.status} />}
            <Badge variant="outline">{assetTypeLabel[asset?.asset_type ?? ""] ?? "—"}</Badge>
            {asset?.supplier && <Badge variant="secondary">{asset.supplier}</Badge>}
            <SourceBadge intuneDeviceId={asset?.intune_device_id} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Série {asset?.serial_number ?? "—"}
            {asset?.intune_last_sync
              ? ` · Última verificação ${formatDateTime(asset.intune_last_sync)}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-display text-sm">Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                Você tem acesso somente de consulta.
              </p>
            )}
            {canEdit && (
              <>
                <Button
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  disabled={!!active}
                  onClick={() => setAssignOpen(true)}
                >
                  <UserPlus className="mr-2 size-4" /> Vincular a uma pessoa
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  disabled={!active}
                  onClick={() => setReturnOpen(true)}
                >
                  <Undo2 className="mr-2 size-4" /> Registrar devolução
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  disabled={!activeAgreement || activeAgreement.status === "assinado" || send.isPending}
                  onClick={() => activeAgreement && send.mutate(activeAgreement.id)}
                >
                  <FileSignature className="mr-2 size-4" /> Enviar termo para assinatura
                </Button>
                {asset?.status === "manutencao" ? (
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                    onClick={() => changeStatus.mutate("disponivel")}
                  >
                    <Wrench className="mr-2 size-4" /> Voltar para disponível
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                    disabled={!!active}
                    onClick={() => changeStatus.mutate("manutencao")}
                  >
                    <Wrench className="mr-2 size-4" /> Marcar em manutenção
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="detalhes">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="usuario">Usuário e histórico</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="mt-4 space-y-4">
            <FieldGrid
              title="Hardware"
              fields={[
                ["Tipo", assetTypeLabel[asset?.asset_type ?? ""] ?? asset?.asset_type],
                ["Marca", asset?.brand],
                ["Modelo", asset?.model],
                ["Condição", asset?.condition],
              ]}
            />
            <FieldGrid
              title="Identificação"
              fields={[
                ["Número de série", asset?.serial_number],
                ["Patrimônio", asset?.patrimony],
                ["IMEI", asset?.imei],
              ]}
              columns={3}
            />
            <FieldGrid
              title="Contrato"
              fields={[
                ["Fornecedor", asset?.supplier],
                ["Contrato", asset?.contract_number],
                ["Custo mensal", formatMoney(asset?.monthly_cost)],
                ["Início da locação", formatDate(asset?.lease_start)],
                ["Fim da locação", formatDate(asset?.lease_end)],
              ]}
            />
            <FieldGrid
              title="Gestão"
              fields={[
                ["Localidade", asset?.location],
                ["ID no Intune", asset?.intune_device_id],
                ["Última sincronização", formatDateTime(asset?.intune_last_sync)],
                ["Observações", asset?.notes],
              ]}
            />
          </TabsContent>

          <TabsContent value="usuario" className="mt-4 space-y-4">
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
              <div className="mt-3 space-y-3">
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        {employee ? (
                          <Link
                            to="/pessoas/$id"
                            params={{ id: employee.id }}
                            className="text-sm font-medium hover:text-primary hover:underline"
                          >
                            {employee.full_name}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium">—</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Entrega {formatDate(h.assigned_at)}
                          {h.returned_at ? ` · Devolução ${formatDate(h.returned_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {agreement && <StatusBadge value={agreement.status} />}
                        <StatusBadge value={h.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <DocumentsPanel filter={{ assetId: id }} />
          </TabsContent>
        </Tabs>
      </div>

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
            <Button
              onClick={() => createAssignment.mutate()}
              disabled={createAssignment.isPending}
            >
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
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => closeAssignment.mutate()} disabled={closeAssignment.isPending}>
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
