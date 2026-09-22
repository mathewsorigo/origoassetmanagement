import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, type SortDir } from "@/hooks/useTableState";

export function SortableHead({
  label,
  columnKey,
  sortKey,
  sortDir,
  onToggle,
  className,
}: {
  label: string;
  columnKey: string;
  sortKey: string | null;
  sortDir: SortDir | null;
  onToggle: (key: string) => void;
  className?: string;
}) {
  const active = sortKey === columnKey;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(active && "text-primary", className)}>
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        aria-label={`Ordenar por ${label}`}
        className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 uppercase transition-colors hover:text-primary"
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
      </button>
    </TableHead>
  );
}

export function TablePagination({
  total,
  rangeStart,
  rangeEnd,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  noun = "itens",
  className,
}: {
  total: number;
  rangeStart: number;
  rangeEnd: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  noun?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span>Itens por página</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[74px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">
          Mostrando {rangeStart.toLocaleString("pt-BR")}–{rangeEnd.toLocaleString("pt-BR")} de{" "}
          {total.toLocaleString("pt-BR")} {noun}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="mr-1">
          Página {page} de {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Primeira página"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(pageCount)}
          aria-label="Última página"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
