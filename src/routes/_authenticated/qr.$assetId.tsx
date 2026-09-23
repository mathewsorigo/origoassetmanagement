import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  QrCode,
  Undo2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/asset-visual";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChecklistFields,
  emptyChecklist,
  saveAssignmentChecklist,
  type ChecklistItem,
} from "@/components/assignment-checklist";
import { supabase } from "@/integrations/supabase/client";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
import { assetTypeLabel, formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/qr/$assetId")({
  head: () => ({
    meta: [
      { title: "Baixa por QR Code · Órigo Ativos" },
      {
        name: "description",
        content: "Leia o QR Code do equipamento e registre a devolução em um toque.",
      },
      { property: "og:title", content: "Baixa por QR Code · Órigo Ativos" },
      {
        property: "og:description",
        content: "Confirmação rápida de devolução do equipamento pelo QR Code.",
      },
    ],
  }),
  component: BaixaPorQr,
});

type ActiveAssignment = {
  id: string;
  assigned_at: string;
  returned_at: string | null;
  delivery_condition: string | null;
  employee: { id: string; full_name: string; email: string } | null;
};

function BaixaPorQr() {
  const { assetId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);

  const [condition, setCondition] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(emptyChecklist());
  const [photos, setPhotos] = useState<File[]>([]);
  const [done, setDone] = useState<{ assignmentId: string; employee: string } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);

  useEffect(() => {
    if (undoLeft <= 0) return;
    const timer = setTimeout(() => setUndoLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [undoLeft]);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["qr-assignments", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id,assigned_at,returned_at,status,delivery_condition,employee:employees(id,full_name,email)")
        .eq("asset_id", assetId)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (ActiveAssignment & { status: string })[];
    },
  });

  const active = assignments?.find((a) => a.status === "ativo") ?? null;
  const lastClosed = assignments?.find((a) => a.status === "encerrado") ?? null;

  const { data: openSession } = useQuery({
    queryKey: ["qr-open-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_sessions")
        .select("id,name")
        .eq("status", "aberta")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const baixa = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Este equipamento não tem vínculo ativo.");
      const { error } = await supabase
        .from("assignments")
        .update({
          status: "encerrado",
          returned_at: new Date().toISOString(),
          return_condition: condition || null,
        })
        .eq("id", active.id);
      if (error) throw error;
      const { error: assetError } = await supabase
        .from("assets")
        .update({ status: "disponivel" })
        .eq("id", assetId);
      if (assetError) throw assetError;

      await logAudit({
        action: "baixa_qr",
        entity: "assignments",
        entityId: active.id,
        details: {
          serial_number: asset?.serial_number ?? null,
          employee: active.employee?.email ?? null,
        },
      });

      try {
        await saveAssignmentChecklist({
          assignmentId: active.id,
          kind: "devolucao",
          items: checklist,
          photos,
          userId: user?.id,
        });
      } catch (checklistError) {
        console.error("Falha ao salvar checklist de devolução:", checklistError);
      }

      return { assignmentId: active.id, employee: active.employee?.full_name ?? "—" };
    },
    onSuccess: (result) => {
      setDone(result);
      setUndoLeft(20);
      toast.success("Devolução registrada. Equipamento disponível novamente.");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desfazer = useMutation({
    mutationFn: async () => {
      if (!done) return;
      const { error } = await supabase
        .from("assignments")
        .update({ status: "ativo", returned_at: null, return_condition: null })
        .eq("id", done.assignmentId);
      if (error) throw error;
      await supabase.from("assets").update({ status: "em_uso" }).eq("id", assetId);
      await logAudit({
        action: "desfazer_baixa_qr",
        entity: "assignments",
        entityId: done.assignmentId,
        details: { serial_number: asset?.serial_number ?? null },
      });
    },
    onSuccess: () => {
      setDone(null);
      setUndoLeft(0);
      setCondition("");
      setChecklist(emptyChecklist());
      setPhotos([]);
      toast.success("Baixa desfeita. O vínculo voltou a ficar ativo.");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conferir = useMutation({
    mutationFn: async () => {
      if (!openSession) return;
      const { error } = await supabase.from("inventory_checks").insert({
        session_id: openSession.id,
        asset_id: assetId,
        checked_by: user?.id ?? null,
      });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
      await logAudit({
        action: "conferir_qr",
        entity: "inventory_checks",
        entityId: openSession.id,
        details: { serial_number: asset?.serial_number ?? null },
      });
    },
    onSuccess: () => {
      toast.success("Equipamento marcado como conferido na contagem em andamento.");
      queryClient.invalidateQueries({ queryKey: ["inventory-checks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" /> Equipamento não encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Esta etiqueta não corresponde a nenhum equipamento cadastrado.</p>
            <Button variant="outline" onClick={() => navigate({ to: "/ativos" })}>
              Ir para a lista de equipamentos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nome = `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number;

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg space-y-3 overflow-x-hidden pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:space-y-4">
      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <AssetIcon type={asset.asset_type} model={asset.model} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <p className="break-words text-base font-semibold">{nome}</p>
            <p className="break-all text-xs text-muted-foreground">
              {assetTypeLabel[asset.asset_type]} · Série {asset.serial_number}
              {asset.patrimony ? ` · Pat. ${asset.patrimony}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge value={asset.status} />
              {asset.location ? (
                <span className="text-xs text-muted-foreground">{asset.location}</span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {done ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-success">
              <CheckCircle2 className="size-4" /> Devolução registrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O equipamento voltou para <strong>Disponível</strong> e o vínculo com{" "}
              {done.employee} foi encerrado.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {undoLeft > 0 && (
                <Button variant="outline" onClick={() => desfazer.mutate()} disabled={desfazer.isPending}>
                  {desfazer.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Undo2 className="mr-2 size-4" />
                  )}
                  Desfazer ({undoLeft}s)
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate({ to: "/ativos" })}>
                <QrCode className="mr-2 size-4" /> Ler outro equipamento
              </Button>
              <Button asChild variant="ghost">
                <Link to="/ativos/$id" params={{ id: assetId }}>
                  Ficha completa <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : active ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar devolução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="break-words font-medium">{active.employee?.full_name ?? "—"}</p>
              <p className="break-all text-xs text-muted-foreground">{active.employee?.email ?? ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Em uso desde {formatDateTime(active.assigned_at)}
              </p>
            </div>

            {canEdit ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="condicao">Condição na devolução</Label>
                  <Input
                    id="condicao"
                    className="h-11"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="Ex.: em bom estado, com carregador"
                  />
                </div>
                <ChecklistFields
                  items={checklist}
                  onChange={setChecklist}
                  photos={photos}
                  onPhotos={setPhotos}
                />
                <div className="sticky bottom-0 -mx-4 border-t bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <Button
                  className="h-12 w-full text-base"
                  onClick={() => baixa.mutate()}
                  disabled={baixa.isPending}
                >
                  {baixa.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 size-4" />
                  )}
                  Confirmar devolução
                </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você tem permissão apenas de consulta. Peça ao time de TI para registrar a
                devolução.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem responsável no momento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Este equipamento não está vinculado a ninguém, então não há devolução a registrar.
            </p>
            {lastClosed ? (
              <p className="text-xs">
                Última devolução: {lastClosed.returned_at ? formatDateTime(lastClosed.returned_at) : "—"}
                {lastClosed.employee ? ` · ${lastClosed.employee.full_name}` : ""}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canEdit && (
                <Button asChild>
                  <Link to="/vinculos">
                    <UserPlus className="mr-2 size-4" /> Vincular a alguém
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/ativos/$id" params={{ id: assetId }}>
                  Ficha completa
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {openSession && canEdit ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">Conferência em andamento</p>
              <p className="break-words text-xs text-muted-foreground">{openSession.name}</p>
            </div>
            <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => conferir.mutate()} disabled={conferir.isPending}>
              {conferir.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ClipboardCheck className="mr-2 size-4" />
              )}
              Marcar como conferido
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
