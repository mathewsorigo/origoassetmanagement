import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AssetIcon, SourceBadge } from "@/components/asset-visual";
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
import { assetStatusLabel, assetTypeLabel, formatDate, formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { exportToExcel } from "@/lib/excel";

export const Route = createFileRoute("/_authenticated/ativos")({
  head: () => ({
    meta: [
      { title: "Ativos · Órigo Ativos" },
      {
        name: "description",
        content: "Inventário de notebooks e celulares alugados, com série, modelo e situação.",
      },
      { property: "og:title", content: "Ativos · Órigo Ativos" },
      { property: "og:description", content: "Inventário de equipamentos da Órigo Energia." },
    ],
  }),
  component: Ativos,
});

const emptyForm = {
  asset_type: "notebook",
  brand: "",
  model: "",
  serial_number: "",
  patrimony: "",
  imei: "",
  supplier: "Simpress",
  contract_number: "",
  status: "disponivel",
  condition: "",
  location: "",
  monthly_cost: "",
  lease_start: "",
  lease_end: "",
  notes: "",
};

function Ativos() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "*, assignments(id,status,employee:employees(id,full_name))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.serial_number.trim()) throw new Error("Informe o número de série.");
      const payload = {
        asset_type: form.asset_type as "notebook",
        brand: form.brand || null,
        model: form.model || null,
        serial_number: form.serial_number.trim(),
        patrimony: form.patrimony || null,
        imei: form.imei || null,
        supplier: form.supplier || null,
        contract_number: form.contract_number || null,
        status: form.status as "disponivel",
        condition: form.condition || null,
        location: form.location || null,
        monthly_cost: form.monthly_cost ? Number(form.monthly_cost) : null,
        lease_start: form.lease_start || null,
        lease_end: form.lease_end || null,
        notes: form.notes || null,
      };
      const { data, error } = await supabase.from("assets").insert(payload).select("id").single();
      if (error) throw error;
      await logAudit({
        action: "criar",
        entity: "assets",
        entityId: data.id,
        details: { serial_number: payload.serial_number },
      });
    },
    onSuccess: () => {
      toast.success("Ativo cadastrado.");
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (assets ?? []).filter((a) => {
      if (statusFilter !== "todos" && a.status !== statusFilter) return false;
      if (typeFilter !== "todos" && a.asset_type !== typeFilter) return false;
      if (!t) return true;
      return [a.serial_number, a.brand, a.model, a.patrimony, a.imei, a.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [assets, term, statusFilter, typeFilter]);

  function holderOf(asset: (typeof filtered)[number]) {
    const active = (asset.assignments as Array<{
      status: string;
      employee: { id: string; full_name: string } | null;
    }> | null)?.find((x) => x.status === "ativo");
    return active?.employee ?? null;
  }

  return (
    <div>
      <PageHeader
        title="Ativos"
        description="Notebooks e celulares alugados pela Simpress e demais fornecedores."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  "ativos",
                  filtered.map((a) => ({
                    Tipo: assetTypeLabel[a.asset_type],
                    Marca: a.brand,
                    Modelo: a.model,
                    Série: a.serial_number,
                    Patrimônio: a.patrimony,
                    IMEI: a.imei,
                    Fornecedor: a.supplier,
                    Situação: assetStatusLabel[a.status],
                    Usuário: holderOf(a)?.full_name ?? "",
                    "Custo mensal": a.monthly_cost,
                    "Fim da locação": a.lease_end,
                  })),
                )
              }
            >
              Exportar Excel
            </Button>
            {canEdit && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 size-4" /> Novo ativo
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por série, modelo, patrimônio…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(assetTypeLabel).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              {Object.entries(assetStatusLabel).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Usuário atual</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Locação</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum ativo encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => {
                const holder = holderOf(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AssetIcon type={a.asset_type} />
                        <div className="min-w-0">
                          <Link
                            to="/ativos/$id"
                            params={{ id: a.id }}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {`${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {assetTypeLabel[a.asset_type]} · Série {a.serial_number}
                            {a.patrimony ? ` · Pat. ${a.patrimony}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {holder ? (
                        <Link
                          to="/pessoas/$id"
                          params={{ id: holder.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {holder.full_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.supplier ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.lease_end ? `até ${formatDate(a.lease_end)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge value={a.status} />
                        <SourceBadge intuneDeviceId={a.intune_device_id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Novo ativo</DialogTitle>
            <DialogDescription>
              Cadastre o equipamento com os dados do contrato de locação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.asset_type}
                onValueChange={(v) => setForm({ ...form, asset_type: v })}
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
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
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
                ["serial_number", "Número de série *"],
                ["patrimony", "Patrimônio"],
                ["imei", "IMEI (celulares)"],
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
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Início da locação</Label>
              <Input
                type="date"
                value={form.lease_start}
                onChange={(e) => setForm({ ...form, lease_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim da locação</Label>
              <Input
                type="date"
                value={form.lease_end}
                onChange={(e) => setForm({ ...form, lease_end: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
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
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Salvar ativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
