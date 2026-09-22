import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
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
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [openContract, setOpenContract] = useState<ContractGroup | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["contratos-assets"],
    queryFn: async () => {
      const CHUNK = 1000;
      const all: AssetRow[] = [];
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from("assets")
          .select(
            "id,serial_number,brand,model,asset_type,status,supplier,contract_number,lease_start,lease_end",
          )
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
      const key = asset.contract_number?.trim() || "sem-contrato";
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
        contract: key === "sem-contrato" ? "Sem número de contrato" : key,
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

  return (
    <div>
      <PageHeader
        breadcrumb="Contratos"
        title="Contratos e locações"
        description="Agrupe os equipamentos por contrato Simpress, acompanhe vencimentos e gere a lista de devolução."
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
                ? groups.length
                : f.key === "vencidas"
                  ? groups.filter((g) => g.situacao === "vencida").length
                  : groups.filter(
                      (g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= Number(f.key),
                    ).length}
            </span>
          </button>
        ))}
      </div>

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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="contratos"
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
    </div>
  );
}
