import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActions({
  onEdit,
  onDelete,
  label = "Ações",
}: {
  onEdit: () => void;
  onDelete: () => void;
  label?: string;
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
        <DropdownMenuItem
          variant="destructive"
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
