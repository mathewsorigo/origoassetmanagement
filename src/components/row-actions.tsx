import { MoreVertical, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowExtraAction = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
};

export function RowActions({
  onEdit,
  onDelete,
  label = "Ações",
  extra,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label?: string;
  extra?: RowExtraAction[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onEdit();
          }}
        >
          <Pencil className="mr-2 size-4" /> Editar
        </DropdownMenuItem>
        {(extra ?? []).map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={(e) => {
              e.preventDefault();
              action.onSelect();
            }}
          >
            {action.icon && <action.icon className="mr-2 size-4" />} {action.label}
          </DropdownMenuItem>
        ))}
        {(extra ?? []).length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            onDelete();
          }}
        >
          <Trash2 className="mr-2 size-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
