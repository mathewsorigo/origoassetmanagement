import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  PackageSearch,
  Download,
  QrCode,
  Tags,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { useTableState } from "@/hooks/useTableState";
import { useColumns, useSavedViews, useViewMode } from "@/hooks/useTableView";
import { ViewToggle } from "@/components/view-toggle";
import { ColumnPicker } from "@/components/column-picker";
import { SavedViews } from "@/components/saved-views";
import { AssetCardGrid } from "@/components/asset-card-grid";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AssetIcon, SourceBadge } from "@/components/asset-visual";
import { AssetDetailPanel } from "@/components/asset-detail-panel";
import { RowActions } from "@/components/row-actions";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { TagPicker } from "@/components/tag-picker";
import { TagBadge } from "@/components/tag-badge";
import { useAssetTags, useTags } from "@/lib/tags";
import { exportToCsv, openQrSheet } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deleteAssetCascade } from "@/lib/entity-delete";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/_authenticated/ativos/")({
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
  const [tagFilter, setTagFilter] = useState("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tagTarget, setTagTarget] = useState<string[] | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    serial: string;
  } | null>(null);

  const { mode: viewMode, setMode: setViewMode } = useViewMode("ativos");
  const columns = useColumns("ativos", [
    { id: "equipamento", label: "Equipamento", locked: true },
    { id: "usuario", label: "Usuário atual" },
    { id: "fornecedor", label: "Fornecedor" },
    { id: "locacao", label: "Locação" },
    { id: "situacao", label: "Situação", locked: true },
  ]);
  const savedViews = useSavedViews("ativos");
  const visibleColumns = columns.columns.filter((c) => columns.isVisible(c.id));
  const currentFilters = {
    term,
    tipo: typeFilter,
    situacao: statusFilter,
    etiqueta: tagFilter,
  };

  function applyView(filters: Record<string, string>) {
    setTerm(filters["term"] ?? "");
    setTypeFilter(filters["tipo"] ?? "todos");
    setStatusFilter(filters["situacao"] ?? "todos");
    setTagFilter(filters["etiqueta"] ?? "todas");
  }

  const { data: tagList } = useTags();
  const { data: assetTagMap } = useAssetTags();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const pageSize = 1000;
      const all: NonNullable<Awaited<ReturnType<typeof fetchPage>>> = [];
      async function fetchPage(from: number) {
        const { data, error } = await supabase
          .from("assets")
          .select("*, assignments(id,status,employee:employees(id,full_name))")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return data ?? [];
      }
      for (let from = 0; ; from += pageSize) {
        const page = await fetchPage(from);
        all.push(...page);
        if (page.length < pageSize) break;
      }
      return all;
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

  const removeAsset = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      await deleteAssetCascade(deleteTarget.id, { serial_number: deleteTarget.serial });
    },
    onSuccess: () => {
      toast.success("Ativo excluído.");
      if (deleteTarget?.id === selectedId) setSelectedId(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (assets ?? []).filter((a) => {
      if (statusFilter !== "todos" && a.status !== statusFilter) return false;
      if (typeFilter !== "todos" && a.asset_type !== typeFilter) return false;
      if (tagFilter !== "todas") {
        const tags = assetTagMap?.get(a.id) ?? [];
        if (!tags.some((tag) => tag.id === tagFilter)) return false;
      }
      if (!t) return true;
      return [a.serial_number, a.brand, a.model, a.patrimony, a.imei, a.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [assets, term, statusFilter, typeFilter, tagFilter, assetTagMap]);

  const table = useTableState(filtered, {
    key: "ativos",
    accessors: {
      equipamento: (a) => `${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number,
      usuario: (a) => holderOf(a)?.full_name ?? null,
      fornecedor: (a) => a.supplier,
      locacao: (a) => a.lease_end,
      situacao: (a) => assetStatusLabel[a.status],
    },
  });
  const pageRows = table.pageRows;
  const allChecked = pageRows.length > 0 && pageRows.every((a) => checked.has(a.id));

  function toggleRow(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((a) => next.delete(a.id));
      else pageRows.forEach((a) => next.add(a.id));
      return next;
    });
  }

  function holderOf(asset: (typeof filtered)[number]) {
    const active = (asset.assignments as Array<{
      status: string;
      employee: { id: string; full_name: string } | null;
    }> | null)?.find((x) => x.status === "ativo");
    return active?.employee ?? null;
  }

  function rowsToExport(list: typeof filtered) {
    return list.map((a) => ({
      Tipo: assetTypeLabel[a.asset_type],
      Marca: a.brand,
      Modelo: a.model,
      Série: a.serial_number,
      Patrimônio: a.patrimony,
      IMEI: a.imei,
      Fornecedor: a.supplier,
      Situação: assetStatusLabel[a.status],
      Usuário: holderOf(a)?.full_name ?? "",
      Etiquetas: (assetTagMap?.get(a.id) ?? []).map((t) => t.name).join(", "),
      "Custo mensal": a.monthly_cost,
      "Fim da locação": a.lease_end,
    }));
  }

  const selectedAssets = filtered.filter((a) => checked.has(a.id));

  async function generateQr(list: typeof filtered) {
    if (!list.length) {
      toast.error("Selecione ao menos um equipamento.");
      return;
    }
    await openQrSheet(
      list.map((a) => ({
        title: `${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number,
        subtitle: `Série ${a.serial_number}${a.patrimony ? ` · Pat. ${a.patrimony}` : ""}`,
        value: `${window.location.origin}/qr/${a.id}`,
      })),
    );
  }

  const removeSelected = useMutation({
    mutationFn: async () => {
      for (const asset of selectedAssets) {
        await deleteAssetCascade(asset.id, { serial_number: asset.serial_number });
      }
    },
    onSuccess: () => {
      toast.success("Equipamentos excluídos.");
      setChecked(new Set());
      setBulkDelete(false);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Equipamentos"
        title="Ativos"
        description="Notebooks e celulares alugados pela Simpress e demais fornecedores."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 size-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToExcel("ativos", rowsToExport(filtered))}>
                  <FileSpreadsheet className="mr-2 size-4" /> Planilha XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCsv("ativos", rowsToExport(filtered))}>
                  <Download className="mr-2 size-4" /> Arquivo CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => generateQr(selectedAssets.length ? selectedAssets : filtered)}
                >
                  <QrCode className="mr-2 size-4" /> Gerar QR Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as etiquetas</SelectItem>
              {(tagList ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "equipamento" : "equipamentos"}
          </span>
          {typeFilter !== "todos" && (
            <button
              className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
              onClick={() => setTypeFilter("todos")}
            >
              {assetTypeLabel[typeFilter]} <X className="size-3" />
            </button>
          )}
          {statusFilter !== "todos" && (
            <button
              className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
              onClick={() => setStatusFilter("todos")}
            >
              {assetStatusLabel[statusFilter]} <X className="size-3" />
            </button>
          )}
          {term && (
            <button
              className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
              onClick={() => setTerm("")}
            >
              “{term}” <X className="size-3" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SavedViews
              views={savedViews.views}
              current={currentFilters}
              onSave={savedViews.save}
              onRemove={savedViews.remove}
              onApply={applyView}
            />
            <ColumnPicker
              columns={columns.columns}
              isVisible={columns.isVisible}
              onToggle={columns.toggle}
              onReset={columns.reset}
            />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="mt-3">
            {!isLoading && filtered.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="Nenhum equipamento encontrado"
                description="Ajuste os filtros ou cadastre um novo equipamento."
              />
            ) : (
              <AssetCardGrid
                items={pageRows}
                selectedId={selectedId}
                checked={checked}
                onOpen={(id) => setSelectedId(id)}
                onToggleCheck={toggleRow}
                tagsOf={(id) => assetTagMap?.get(id) ?? []}
                holderOf={(id) => {
                  const row = pageRows.find((x) => x.id === id);
                  return row ? (holderOf(row)?.full_name ?? null) : null;
                }}
                actions={(item) =>
                  canEdit ? (
                    <RowActions
                      onEdit={() => {
                        setPanelMode("edit");
                        setSelectedId(item.id);
                      }}
                      onDelete={() =>
                        setDeleteTarget({
                          id: item.id,
                          title:
                            `${item.brand ?? ""} ${item.model ?? ""}`.trim() || item.serial_number,
                          serial: item.serial_number,
                        })
                      }
                      extra={[
                        { label: "Etiquetas", icon: Tags, onSelect: () => setTagTarget([item.id]) },
                      ]}
                    />
                  ) : null
                }
              />
            )}
          </div>
        ) : (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={togglePage}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                {visibleColumns.map(({ id: columnKey, label }) => (
                  <SortableHead
                    key={columnKey}
                    columnKey={columnKey}
                    label={label}
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onToggle={table.toggleSort}
                  />
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: visibleColumns.length + 2 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="py-8">
                    <EmptyState
                      icon={PackageSearch}
                      title="Nenhum equipamento encontrado"
                      description="Ajuste os filtros ou cadastre um novo equipamento."
                    />
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((a, index) => {
                const holder = holderOf(a);
                const selected = selectedId === a.id;
                const tags = assetTagMap?.get(a.id) ?? [];
                return (
                  <TableRow
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    className={cn(
                      "cursor-pointer animate-in fade-in-0 slide-in-from-bottom-1 transition-colors",
                      selected && "bg-primary/[0.07] hover:bg-primary/10",
                    )}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked.has(a.id)}
                        onCheckedChange={() => toggleRow(a.id)}
                        aria-label="Selecionar equipamento"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AssetIcon type={a.asset_type} model={a.model} />
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "font-medium text-foreground transition-colors",
                              selected && "text-primary",
                            )}
                          >
                            {`${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assetTypeLabel[a.asset_type]} · Série {a.serial_number}
                            {a.patrimony ? ` · Pat. ${a.patrimony}` : ""}
                          </p>
                          {tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {tags.map((tag) => (
                                <TagBadge key={tag.id} tag={tag} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {columns.isVisible("usuario") && (
                      <TableCell className="text-[13px]">
                        {holder ? (
                          holder.full_name
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {columns.isVisible("fornecedor") && (
                      <TableCell className="text-[13px]">{a.supplier ?? "—"}</TableCell>
                    )}
                    {columns.isVisible("locacao") && (
                      <TableCell className="num text-xs text-muted-foreground">
                        {a.lease_end ? `até ${formatDate(a.lease_end)}` : "—"}
                      </TableCell>
                    )}
                    {columns.isVisible("situacao") && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge value={a.status} />
                          <SourceBadge intuneDeviceId={a.intune_device_id} />
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <RowActions
                          onEdit={() => {
                            setPanelMode("edit");
                            setSelectedId(a.id);
                          }}
                          onDelete={() =>
                            setDeleteTarget({
                              id: a.id,
                              title:
                                `${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number,
                              serial: a.serial_number,
                            })
                          }
                          extra={[
                            {
                              label: "Etiquetas",
                              icon: Tags,
                              onSelect: () => setTagTarget([a.id]),
                            },
                            {
                              label: "Gerar QR Code",
                              icon: QrCode,
                              onSelect: () => generateQr([a]),
                            },
                          ]}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        )}

        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="equipamentos"
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

      <BulkActionBar
        count={checked.size}
        total={filtered.length}
        noun="equipamentos"
        onClear={() => setChecked(new Set())}
      >
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setTagTarget([...checked])}>
            <Tags className="mr-1.5 size-4" /> Etiquetas
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => generateQr(selectedAssets)}>
          <QrCode className="mr-1.5 size-4" /> QR Code
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportToExcel("ativos-selecionados", rowsToExport(selectedAssets))}
        >
          <FileSpreadsheet className="mr-1.5 size-4" /> Exportar
        </Button>
        {canEdit && (
          <Button size="sm" variant="destructive" onClick={() => setBulkDelete(true)}>
            <Trash2 className="mr-1.5 size-4" /> Excluir
          </Button>
        )}
      </BulkActionBar>

      <TagPicker
        assetIds={tagTarget ?? []}
        open={!!tagTarget}
        onOpenChange={(v) => !v && setTagTarget(null)}
      />

      <AlertDialog open={bulkDelete} onOpenChange={setBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Excluir {checked.size} equipamentos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os vínculos, termos e documentos desses equipamentos também serão apagados.
              Equipamentos com vínculo ativo precisam da devolução registrada antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSelected.isPending}
              onClick={(e) => {
                e.preventDefault();
                removeSelected.mutate();
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AssetDetailPanel
        assetId={selectedId}
        initialMode={panelMode}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedId(null);
            setPanelMode("view");
          }
        }}
        onNavigate={(dir) => {
          const i = filtered.findIndex((a) => a.id === selectedId);
          if (i < 0) return;
          const next = filtered[i + dir];
          if (next) setSelectedId(next.id);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir equipamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title} · série {deleteTarget?.serial}. O histórico de vínculos, termos
              e documentos deste equipamento também serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeAsset.isPending}
              onClick={(e) => {
                e.preventDefault();
                removeAsset.mutate();
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
