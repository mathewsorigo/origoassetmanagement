import { escapeLike } from "@/lib/query";
import { fetchAll } from "@/lib/fetch-all";
import { QueryError } from "@/components/query-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Download,
  Flag,
  Loader2,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession, isOperator } from "@/hooks/useAuth";
import { assetStatusLabel, assetTypeLabel, formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { exportToCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/inventario/$sessionId")({
  head: () => ({
    meta: [
      { title: "Conferência · Órigo Ativos" },
      { name: "description", content: "Conferência física de equipamentos por QR Code." },
      { property: "og:title", content: "Conferência · Órigo Ativos" },
      { property: "og:description", content: "Conferência física de equipamentos por QR Code." },
    ],
  }),
  component: Conferencia,
});

type AssetRow = {
  id: string;
  serial_number: string;
  brand: string | null;
  model: string | null;
  asset_type: string;
  status: string;
  location: string | null;
};

type CheckRow = {
  id: string;
  asset_id: string;
  checked_at: string;
  divergencia: string | null;
  asset: AssetRow | null;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function Conferencia() {
  const { sessionId } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [serial, setSerial] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const {
    data: session,
    isLoading: loadingSession,
    isError: sessionError,
    refetch: retrySession,
  } = useQuery({
    queryKey: ["inventory-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_sessions")
        .select("id,name,scope,status,created_at,closed_at,snapshot,snapshot_at")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const scope = (session?.scope ?? {}) as Record<string, string>;
  const aberta = session?.status === "aberta";

  const scopeAssets = useMemo(
    () => (session?.snapshot ?? []) as unknown as AssetRow[],
    [session?.snapshot],
  );
  const loadingAssets = loadingSession;

  const {
    data: checks,
    isLoading: loadingChecks,
    isError: checksError,
    refetch: retryChecks,
  } = useQuery({
    queryKey: ["inventory-checks", sessionId],
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from("inventory_checks")
          .select("id,asset_id,checked_at,divergencia,asset:asset_snapshot")
          .eq("session_id", sessionId)
          .order("checked_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      return rows as unknown as CheckRow[];
    },
  });

  const checkedIds = useMemo(() => new Set((checks ?? []).map((c) => c.asset_id)), [checks]);
  const scopeIds = useMemo(() => new Set((scopeAssets ?? []).map((a) => a.id)), [scopeAssets]);
  const missing = useMemo(
    () => (scopeAssets ?? []).filter((a) => !checkedIds.has(a.id)),
    [scopeAssets, checkedIds],
  );
  const outOfScope = useMemo(
    () => (checks ?? []).filter((c) => !scopeIds.has(c.asset_id)),
    [checks, scopeIds],
  );

  // Leitor de QR pela câmera (carregado sob demanda)
  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("inventory-qr-reader");
      instance = scanner;
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            void handleCode(text);
          },
          () => {},
        );
      } catch {
        toast.error("Não foi possível acessar a câmera. Use a digitação da série.");
        setCameraOn(false);
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current = null;
      instance
        ?.stop()
        .catch(() => {})
        .finally(() => instance?.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  async function findAsset(raw: string): Promise<AssetRow | null> {
    const text = raw.trim();
    const uuid = text.match(UUID_RE)?.[0];
    const pool = scopeAssets ?? [];
    if (uuid) {
      const byId = pool.find((a) => a.id === uuid);
      if (byId) return byId;
      const { data } = await supabase
        .from("assets")
        .select("id,serial_number,brand,model,asset_type,status,location")
        .is("archived_at", null)
        .eq("id", uuid)
        .maybeSingle();
      if (data) return data as AssetRow;
    }
    const bySerial = pool.find((a) => a.serial_number.toLowerCase() === text.toLowerCase());
    if (bySerial) return bySerial;
    const { data } = await supabase
      .from("assets")
      .select("id,serial_number,brand,model,asset_type,status,location")
      .is("archived_at", null)
      .ilike("serial_number", escapeLike(text))
      .limit(1)
      .maybeSingle();
    return (data as AssetRow | null) ?? null;
  }

  const check = useMutation({
    mutationFn: async (raw: string) => {
      const asset = await findAsset(raw);
      if (!asset) throw new Error(`Nenhum equipamento encontrado para "${raw.trim()}".`);
      if (checkedIds.has(asset.id)) throw new Error(`Série ${asset.serial_number} já conferida.`);
      const divergencia = scopeIds.size > 0 && !scopeIds.has(asset.id) ? "Fora do escopo" : null;
      const { error } = await supabase.from("inventory_checks").insert({
        session_id: sessionId,
        asset_id: asset.id,
        checked_by: user?.id ?? null,
        divergencia,
      });
      if (error) {
        if (error.message.includes("duplicate") || error.code === "23505") {
          throw new Error(`Série ${asset.serial_number} já conferida.`);
        }
        throw error;
      }
      return asset;
    },
    onSuccess: (asset) => {
      toast.success(`Conferido: ${asset.serial_number}`);
      setSerial("");
      queryClient.invalidateQueries({ queryKey: ["inventory-checks", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCode(text: string) {
    if (check.isPending) return;
    check.mutate(text);
  }

  const closeSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("inventory_sessions")
        .update({ status: "encerrada", closed_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
      await logAudit({
        action: "encerrar_inventario",
        entity: "inventory_sessions",
        entityId: sessionId,
        details: { conferidos: checks?.length ?? 0, pendentes: missing.length },
      });
    },
    onSuccess: () => {
      toast.success("Conferência encerrada.");
      setConfirmClose(false);
      setCameraOn(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markMissing = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("qa_transaction", {
        p_action: "inventory_missing",
        p_data: { id: sessionId },
      });
      if (error) throw error;
      return data as { count: number };
    },
    onSuccess: (result) => {
      toast.success(`${result.count} equipamento(s) marcados como extraviado.`);
      setConfirmMissing(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportReport() {
    exportToCsv(`inventario-${session?.name ?? sessionId}`, [
      ...(checks ?? []).map((c) => ({
        resultado: c.divergencia ? `conferido (${c.divergencia})` : "conferido",
        serie: c.asset?.serial_number ?? "",
        equipamento: `${c.asset?.brand ?? ""} ${c.asset?.model ?? ""}`.trim(),
        situacao: c.asset ? (assetStatusLabel[c.asset.status] ?? c.asset.status) : "",
        conferido_em: c.checked_at,
      })),
      ...missing.map((a) => ({
        resultado: "não encontrado",
        serie: a.serial_number,
        equipamento: `${a.brand ?? ""} ${a.model ?? ""}`.trim(),
        situacao: assetStatusLabel[a.status] ?? a.status,
        conferido_em: "",
      })),
    ]);
  }

  const loading = loadingSession || loadingAssets || loadingChecks;
  if (sessionError || checksError)
    return (
      <QueryError
        retry={() => {
          void retrySession();
          void retryChecks();
        }}
      />
    );

  return (
    <div>
      <PageHeader
        breadcrumb="Inventário › Conferência"
        title={session?.name ?? "Conferência"}
        description={
          aberta
            ? "Leia o QR Code do equipamento ou digite o número de série para marcar como conferido."
            : "Conferência encerrada. Veja o relatório abaixo."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/inventario">
                <ArrowLeft className="mr-1.5 size-4" /> Voltar
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="mr-1.5 size-4" /> Relatório CSV
            </Button>
            {aberta && canEdit && (
              <Button variant="outline" size="sm" onClick={() => setConfirmClose(true)}>
                <Flag className="mr-1.5 size-4" /> Encerrar
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conferidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-success">
                  {(checks ?? []).length}
                </p>
                <p className="text-xs text-muted-foreground">
                  de {scopeAssets?.length ?? 0} no escopo
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Não encontrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-warning">{missing.length}</p>
                <p className="text-xs text-muted-foreground">ainda não conferidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fora do escopo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{outOfScope.length}</p>
                <p className="text-xs text-muted-foreground">lidos, mas fora desta conferência</p>
              </CardContent>
            </Card>
          </div>

          {aberta && (
            <Card className="mt-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (serial.trim()) check.mutate(serial);
                  }}
                >
                  <Input
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="Digite o número de série e confirme"
                    className="max-w-sm"
                    autoFocus
                  />
                  <Button type="submit" disabled={check.isPending}>
                    {check.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 size-4" />
                    )}
                    Conferir
                  </Button>
                </form>
                <Button
                  variant={cameraOn ? "destructive" : "outline"}
                  onClick={() => setCameraOn((v) => !v)}
                >
                  {cameraOn ? (
                    <>
                      <CameraOff className="mr-2 size-4" /> Desligar câmera
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 size-4" /> Ler QR Code
                    </>
                  )}
                </Button>
              </div>
              {cameraOn && (
                <div
                  id="inventory-qr-reader"
                  className="mx-auto mt-4 w-full max-w-sm overflow-hidden rounded-lg border"
                />
              )}
            </Card>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="overflow-x-auto p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ScanLine className="size-4 text-primary" /> Conferidos
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Série</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(checks ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Nenhum equipamento conferido ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {(checks ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm tabular-nums">
                        {c.asset?.serial_number ?? "—"}
                        {c.divergencia && (
                          <span className="ml-2 text-xs text-warning">({c.divergencia})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.asset
                          ? `${assetTypeLabel[c.asset.asset_type] ?? c.asset.asset_type} ${
                              c.asset.brand ?? ""
                            } ${c.asset.model ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(c.checked_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="overflow-x-auto p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Não encontrados ({missing.length})</h3>
                {!aberta && canEdit && missing.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmMissing(true)}
                    disabled={markMissing.isPending}
                  >
                    Marcar como extraviado
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Série</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missing.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Tudo conferido. Nenhuma divergência.
                      </TableCell>
                    </TableRow>
                  )}
                  {missing.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm tabular-nums">{a.serial_number}</TableCell>
                      <TableCell className="text-sm">
                        {assetTypeLabel[a.asset_type] ?? a.asset_type} {a.brand ?? ""}{" "}
                        {a.model ?? ""}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a conferência?</AlertDialogTitle>
            <AlertDialogDescription>
              Restam {missing.length} equipamento(s) sem conferência. Depois de encerrada, você
              poderá marcar os não encontrados como extraviados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar conferindo</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeSession.mutate()}
              disabled={closeSession.isPending}
            >
              Encerrar conferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmMissing} onOpenChange={setConfirmMissing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar não encontrados como extraviados?</AlertDialogTitle>
            <AlertDialogDescription>
              {missing.length} equipamento(s) terão a situação alterada para "Extraviado", com
              registro na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => markMissing.mutate()}
              disabled={markMissing.isPending}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
