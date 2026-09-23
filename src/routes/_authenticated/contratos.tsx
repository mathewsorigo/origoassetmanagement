import { parseMoney, validatePeriod } from "@/lib/validation";
import { QueryError } from "@/components/query-error";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText, Plus, Pencil, Trash2 } from "lucide-react";
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
import { assetStatusLabel, assetTypeLabel, formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { logAudit } from "@/lib/audit";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
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

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos · Órigo Ativos" },
      { name: "description", content: "Locações Simpress por contrato, vencimentos e devolução." },
      { property: "og:title", content: "Contratos · Órigo Ativos" },
      { property: "og:description", content: "Gestão dos contratos de locação de equipamentos." },
    ],
  }),
  component: Contratos,
});

type AssetRow = {
  id: string;
  serial_number: string;
  brand: string | null;
  model: string | null;
  asset_type: string;
  status: string;
  supplier: string | null;
  contract_number: string | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_cost: number | null;
};

type ContractGroup = {
  key: string;
  contract: string;
  supplier: string;
  total: number;
  emUso: number;
  leaseStart: string | null;
  leaseEnd: string | null;
  daysLeft: number | null;
  situacao: "vencida" | "vencendo" | "vigente" | "sem_prazo";
  assets: AssetRow[];
};

const DAY = 1000 * 60 * 60 * 24;
const situacaoLabel: Record<ContractGroup["situacao"], string> = {
  vencida: "Vencida",
  vencendo: "Vencendo",
  vigente: "Vigente",
  sem_prazo: "Sem prazo",
};

const filters = [
  { key: "todas", label: "Todas" },
  { key: "30", label: "Vencem em 30 dias" },
  { key: "60", label: "Vencem em 60 dias" },
  { key: "90", label: "Vencem em 90 dias" },
  { key: "vencidas", label: "Vencidas" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

function Contratos() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [openContract, setOpenContract] = useState<ContractGroup | null>(null);
  const [editContract, setEditContract] = useState<ContractGroup | "new" | null>(null);
  const [deleteContract, setDeleteContract] = useState<ContractGroup | null>(null);
  const [contractForm, setContractForm] = useState({
    contract_number: "",
    supplier: "Simpress",
    lease_start: "",
    lease_end: "",
    monthly_cost: "",
    asset_ids: [] as string[],
  });

  const [contractDirty, setContractDirty] = useState<string[]>([]);
  const {
    data: assets,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["contratos-assets"],
    queryFn: async () => {
      const CHUNK = 1000;
      const all: AssetRow[] = [];
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from("assets")
          .select(
            "id,serial_number,brand,model,asset_type,status,supplier,contract_number,lease_start,lease_end,monthly_cost",
          )
          .is("archived_at", null)
          .order("id")
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        const rows = (data ?? []) as AssetRow[];
        all.push(...rows);
        if (rows.length < CHUNK) break;
      }
      return all;
    },
  });

  const groups = useMemo<ContractGroup[]>(() => {
    const map = new Map<string, AssetRow[]>();
    for (const asset of assets ?? []) {
      const key = asset.contract_number?.trim()
        ? JSON.stringify([asset.supplier?.trim() ?? "", asset.contract_number.trim()])
        : "sem-contrato";
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    const now = Date.now();
    return [...map.entries()].map(([key, list]) => {
      const ends = list.map((a) => a.lease_end).filter(Boolean) as string[];
      const starts = list.map((a) => a.lease_start).filter(Boolean) as string[];
      const leaseEnd = ends.length ? ends.sort()[ends.length - 1]! : null;
      const leaseStart = starts.length ? starts.sort()[0]! : null;
      const daysLeft = leaseEnd ? Math.ceil((new Date(leaseEnd).getTime() - now) / DAY) : null;
      const situacao: ContractGroup["situacao"] =
        daysLeft === null
          ? "sem_prazo"
          : daysLeft < 0
            ? "vencida"
            : daysLeft <= 30
              ? "vencendo"
              : "vigente";
      return {
        key,
        contract: key === "sem-contrato" ? "Sem número de contrato" : list[0]!.contract_number!,
        supplier: list[0]?.supplier?.trim() || "Simpress",
        total: list.length,
        emUso: list.filter((a) => a.status === "em_uso").length,
        leaseStart,
        leaseEnd,
        daysLeft,
        situacao,
        assets: list,
      };
    });
  }, [assets]);

  const filtered = useMemo(() => {
    if (filter === "todas") return groups;
    if (filter === "vencidas") return groups.filter((g) => g.situacao === "vencida");
    const days = Number(filter);
    return groups.filter((g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= days);
  }, [groups, filter]);

  const table = useTableState(filtered, {
    key: "contratos",
    accessors: {
      contrato: (g) => g.contract,
      fornecedor: (g) => g.supplier,
      equipamentos: (g) => g.total,
      inicio: (g) => g.leaseStart,
      fim: (g) => g.leaseEnd,
      dias: (g) => g.daysLeft,
      situacao: (g) => situacaoLabel[g.situacao],
    },
    defaultSort: { key: "fim", dir: "asc" },
  });

  function exportContract(group: ContractGroup) {
    exportToCsv(
      `devolucao-${group.key}`,
      group.assets.map((a) => ({
        contrato: group.contract,
        fornecedor: a.supplier ?? "",
        serie: a.serial_number,
        tipo: assetTypeLabel[a.asset_type] ?? a.asset_type,
        marca: a.brand ?? "",
        modelo: a.model ?? "",
        situacao: assetStatusLabel[a.status] ?? a.status,
        fim_locacao: a.lease_end ?? "",
      })),
    );
  }

  function startContract(group?: ContractGroup) {
    setContractDirty([]);
    setContractForm({
      contract_number: group?.key === "sem-contrato" ? "" : (group?.contract ?? ""),
      supplier: group?.supplier ?? "Simpress",
      lease_start:
        group && new Set(group.assets.map((a) => a.lease_start)).size > 1
          ? ""
          : (group?.leaseStart?.slice(0, 10) ?? ""),
      lease_end:
        group && new Set(group.assets.map((a) => a.lease_end)).size > 1
          ? ""
          : (group?.leaseEnd?.slice(0, 10) ?? ""),
      monthly_cost:
        group && new Set(group.assets.map((a) => a.monthly_cost)).size > 1
          ? ""
          : group?.assets[0]?.monthly_cost != null
            ? String(group.assets[0].monthly_cost)
            : "",
      asset_ids: group?.assets.map((asset) => asset.id) ?? [],
    });
    setEditContract(group ?? "new");
  }

  const saveContract = useMutation({
    mutationFn: async () => {
      if (!contractForm.contract_number.trim()) throw new Error("Informe o número do contrato.");
      if (contractForm.asset_ids.length === 0)
        throw new Error("Selecione ao menos um equipamento.");
      const previousNumber = editContract !== "new" ? editContract?.contract : null;
      const payload = {
        contract_number: contractForm.contract_number.trim(),
        supplier: contractForm.supplier.trim() || null,
        lease_start: contractForm.lease_start || null,
        lease_end: contractForm.lease_end || null,
        monthly_cost: parseMoney(contractForm.monthly_cost),
      };
      const patch = Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) =>
            editContract === "new" ||
            ["contract_number", "supplier"].includes(key) ||
            contractDirty.includes(key),
        ),
      );
      const previousAssets = editContract && editContract !== "new" ? editContract.assets : [];
      if (editContract === "new") validatePeriod(contractForm.lease_start, contractForm.lease_end);
      const { error } = await supabase.rpc("qa_transaction", {
        p_action: "contract",
        p_data: {
          ids: contractForm.asset_ids,
          removed: previousAssets
            .filter((a) => !contractForm.asset_ids.includes(a.id))
            .map((a) => a.id),
          patch,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editContract === "new" ? "Contrato criado." : "Contrato atualizado.");
      setEditContract(null);
      void queryClient.invalidateQueries({ queryKey: ["contratos-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeContract = useMutation({
    mutationFn: async () => {
      if (!deleteContract) return;
      const ids = deleteContract.assets.map((asset) => asset.id);
      const { error } = await supabase.rpc("qa_transaction", {
        p_action: "contract",
        p_data: {
          ids,
          patch: { contract_number: null, lease_start: null, lease_end: null, monthly_cost: null },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato removido dos equipamentos.");
      setDeleteContract(null);
      void queryClient.invalidateQueries({ queryKey: ["contratos-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      {isError && <QueryError retry={refetch} />}
      <PageHeader
        breadcrumb="Contratos"
        title="Contratos e locações"
        description="Agrupe os equipamentos por contrato Simpress, acompanhe vencimentos e gere a lista de devolução."
        actions={
          canEdit ? (
            <Button onClick={() => startContract()}>
              <Plus className="mr-2 size-4" /> Novo contrato
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {f.label}
            <span className="ml-1.5 text-[10px] opacity-70">
              {f.key === "todas"
                ? groups.filter((g) => g.key !== "sem-contrato").length
                : f.key === "vencidas"
                  ? groups.filter((g) => g.situacao === "vencida").length
                  : groups.filter(
                      (g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= Number(f.key),
                    ).length}
            </span>
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {groups.filter((g) => g.key !== "sem-contrato").length} contratos cadastrados ·{" "}
        {groups.find((g) => g.key === "sem-contrato")?.total ?? 0} equipamentos sem contrato. Campos
        com valores diferentes ficam vazios na edição e são preservados até você alterá-los.
      </p>
      <Card className="overflow-x-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ["contrato", "Contrato"],
                  ["fornecedor", "Fornecedor"],
                  ["equipamentos", "Equipamentos"],
                  ["inicio", "Início"],
                  ["fim", "Fim"],
                  ["dias", "Dias restantes"],
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
                <TableCell colSpan={8}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && table.total === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma locação encontrada para este filtro.
                </TableCell>
              </TableRow>
            )}
            {table.pageRows.map((g) => (
              <TableRow key={g.key}>
                <TableCell className="text-sm">
                  <button
                    onClick={() => setOpenContract(g)}
                    className="flex items-center gap-2 font-medium hover:text-primary hover:underline"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    {g.contract}
                  </button>
                </TableCell>
                <TableCell className="text-sm">{g.supplier}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {g.total}
                  <span className="ml-1 text-xs text-muted-foreground">({g.emUso} em uso)</span>
                </TableCell>
                <TableCell className="text-sm">{formatDate(g.leaseStart)}</TableCell>
                <TableCell className="text-sm">{formatDate(g.leaseEnd)}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {g.daysLeft === null
                    ? "—"
                    : g.daysLeft < 0
                      ? `${Math.abs(g.daysLeft)} em atraso`
                      : g.daysLeft}
                </TableCell>
                <TableCell>
                  <StatusBadge value={g.situacao} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setOpenContract(g)}>
                      Ver itens
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => exportContract(g)}>
                      <Download className="mr-1 size-4" /> Devolução
                    </Button>
                    {canEdit && g.key !== "sem-contrato" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar contrato"
                          onClick={() => startContract(g)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover contrato"
                          onClick={() => setDeleteContract(g)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="grupos"
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

      <Dialog open={!!openContract} onOpenChange={(v) => !v && setOpenContract(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">{openContract?.contract}</DialogTitle>
            <DialogDescription>
              {openContract?.supplier} · {openContract?.total} equipamentos · fim da locação{" "}
              {formatDate(openContract?.leaseEnd ?? null)}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Série</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Fim da locação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(openContract?.assets ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm tabular-nums">{a.serial_number}</TableCell>
                  <TableCell className="text-sm">
                    {assetTypeLabel[a.asset_type] ?? a.asset_type} {a.brand ?? ""} {a.model ?? ""}
                  </TableCell>
                  <TableCell className="text-sm">
                    {assetStatusLabel[a.status] ?? a.status}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(a.lease_end)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenContract(null)}>
              Fechar
            </Button>
            <Button onClick={() => openContract && exportContract(openContract)}>
              <Download className="mr-2 size-4" /> Lista de devolução (CSV)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editContract} onOpenChange={(value) => !value && setEditContract(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editContract === "new" ? "Novo contrato" : "Editar contrato"}
            </DialogTitle>
            <DialogDescription>
              Defina os dados e os equipamentos que pertencem a este contrato. Ao editar, somente os
              campos que você alterar serão aplicados. Custos e datas diferentes permanecem
              individuais.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={"qa-contratostsx-19623-"}>Número do contrato</Label>
              <Input
                id={"qa-contratostsx-19623-"}
                value={contractForm.contract_number}
                onChange={(event) => (
                  setContractDirty((d) => [...d, "contract_number"]),
                  setContractForm({ ...contractForm, contract_number: event.target.value })
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-contratostsx-20017-"}>Fornecedor</Label>
              <Input
                id={"qa-contratostsx-20017-"}
                value={contractForm.supplier}
                onChange={(event) => (
                  setContractDirty((d) => [...d, "supplier"]),
                  setContractForm({ ...contractForm, supplier: event.target.value })
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-contratostsx-20382-"}>Início</Label>
              <Input
                id={"qa-contratostsx-20382-"}
                type="date"
                value={contractForm.lease_start}
                onChange={(event) => (
                  setContractDirty((d) => [...d, "lease_start"]),
                  setContractForm({ ...contractForm, lease_start: event.target.value })
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={"qa-contratostsx-20780-"}>Fim</Label>
              <Input
                id={"qa-contratostsx-20780-"}
                type="date"
                value={contractForm.lease_end}
                onChange={(event) => (
                  setContractDirty((d) => [...d, "lease_end"]),
                  setContractForm({ ...contractForm, lease_end: event.target.value })
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={"qa-contratostsx-21183-"}>Custo mensal por equipamento</Label>
              <Input
                id={"qa-contratostsx-21183-"}
                inputMode="decimal"
                value={contractForm.monthly_cost}
                onChange={(event) => (
                  setContractDirty((d) => [...d, "monthly_cost"]),
                  setContractForm({ ...contractForm, monthly_cost: event.target.value })
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Equipamentos</Label>
            <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {(assets ?? []).map((asset) => {
                const checked = contractForm.asset_ids.includes(asset.id);
                return (
                  <label
                    key={asset.id}
                    className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setContractForm((current) => ({
                          ...current,
                          asset_ids: checked
                            ? current.asset_ids.filter((id) => id !== asset.id)
                            : [...current.asset_ids, asset.id],
                        }))
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {asset.serial_number} ·{" "}
                      {`${asset.brand ?? ""} ${asset.model ?? ""}`.trim() ||
                        assetTypeLabel[asset.asset_type]}
                    </span>
                    {asset.contract_number &&
                      asset.contract_number !==
                        (editContract === "new" ? "" : editContract?.key) && (
                        <span className="text-xs text-muted-foreground">
                          {asset.contract_number}
                        </span>
                      )}
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContract(null)}>
              Cancelar
            </Button>
            <Button disabled={saveContract.isPending} onClick={() => saveContract.mutate()}>
              Salvar contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteContract}
        onOpenChange={(value) => !value && setDeleteContract(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados do contrato serão retirados de {deleteContract?.total ?? 0} equipamentos. Os
              ativos não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeContract.isPending}
              onClick={(event) => {
                event.preventDefault();
                removeContract.mutate();
              }}
            >
              Remover contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
