import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck, Plus, ScanLine } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { assetTypeLabel, formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: "Inventário · Órigo Ativos" },
      {
        name: "description",
        content: "Conferência física do parque por QR Code, com relatório de divergências.",
      },
      { property: "og:title", content: "Inventário · Órigo Ativos" },
      { property: "og:description", content: "Auditoria física dos equipamentos da Órigo." },
    ],
  }),
  component: Inventario,
});

type Session = {
  id: string;
  name: string;
  scope: { location?: string; asset_type?: string } | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  inventory_checks: { count: number }[];
};

function Inventario() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "todas", asset_type: "todos" });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inventory-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_sessions")
        .select("id,name,scope,status,created_at,closed_at,inventory_checks(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Session[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const table = useTableState(sessions, {
    key: "inventario",
    accessors: {
      nome: (s) => s.name,
      escopo: (s) =>
        s.scope?.["location"] || s.scope?.["asset_type"]
          ? `${s.scope?.["location"] ?? "Todas as localidades"} · ${
              s.scope?.["asset_type"] ? assetTypeLabel[s.scope["asset_type"]!] : "Todos os tipos"
            }`
          : "Todo o parque",
      conferidos: (s) => s.inventory_checks?.[0]?.count ?? 0,
      abertura: (s) => s.created_at,
      situacao: (s) => s.status,
    },
    defaultSort: { key: "abertura", dir: "desc" },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Dê um nome para a conferência.");
      const scope: Record<string, string> = {};
      if (form.location !== "todas") scope["location"] = form.location;
      if (form.asset_type !== "todos") scope["asset_type"] = form.asset_type;
      const { data, error } = await supabase
        .from("inventory_sessions")
        .insert({ name: form.name.trim(), scope, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        action: "iniciar_inventario",
        entity: "inventory_sessions",
        entityId: data.id,
        details: { name: form.name.trim(), scope },
      });
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Conferência iniciada.");
      setOpen(false);
      setForm({ name: "", location: "todas", asset_type: "todos" });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      navigate({ to: "/inventario/$sessionId", params: { sessionId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Inventário"
        title="Inventário físico"
        description="Conferências do parque com leitura de QR Code ou digitação do número de série."
        actions={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> Nova conferência
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
                  ["nome", "Conferência"],
                  ["escopo", "Escopo"],
                  ["conferidos", "Conferidos"],
                  ["abertura", "Abertura"],
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
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && table.total === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma conferência criada. Clique em "Nova conferência".
                </TableCell>
              </TableRow>
            )}
            {table.pageRows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm">
                  <Link
                    to="/inventario/$sessionId"
                    params={{ sessionId: s.id }}
                    className="flex items-center gap-2 font-medium hover:text-primary hover:underline"
                  >
                    <ClipboardCheck className="size-4 text-muted-foreground" />
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.scope?.["location"] || s.scope?.["asset_type"]
                    ? `${s.scope?.["location"] ?? "Todas as localidades"} · ${
                        s.scope?.["asset_type"]
                          ? (assetTypeLabel[s.scope["asset_type"]!] ?? s.scope["asset_type"])
                          : "Todos os tipos"
                      }`
                    : "Todo o parque"}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {s.inventory_checks?.[0]?.count ?? 0}
                </TableCell>
                <TableCell className="text-sm">{formatDateTime(s.created_at)}</TableCell>
                <TableCell>
                  <StatusBadge value={s.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate({ to: "/inventario/$sessionId", params: { sessionId: s.id } })
                    }
                  >
                    <ScanLine className="mr-1 size-4" />
                    {s.status === "aberta" ? "Conferir" : "Ver relatório"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="conferências"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova conferência</DialogTitle>
            <DialogDescription>
              Defina o universo de equipamentos que será conferido nesta rodada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Sede SP — setembro/2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Localidade</Label>
              <Select
                value={form.location}
                onValueChange={(v) => setForm({ ...form, location: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as localidades</SelectItem>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.name} value={l.name}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de equipamento</Label>
              <Select
                value={form.asset_type}
                onValueChange={(v) => setForm({ ...form, asset_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {Object.entries(assetTypeLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
              Iniciar conferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
