import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/hooks/useTableView";

export function ColumnPicker({
  columns,
  isVisible,
  onToggle,
  onReset,
}: {
  columns: ColumnDef[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Columns3 className="mr-1.5 size-3.5" /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={isVisible(c.id)}
              disabled={c.locked}
              onCheckedChange={() => onToggle(c.id)}
            />
            {c.label}
          </label>
        ))}
        <DropdownMenuSeparator />
        <button
          type="button"
          className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
          onClick={onReset}
        >
          Restaurar padrão
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
