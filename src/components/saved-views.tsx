import { useState } from "react";
import { BookmarkPlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedView } from "@/hooks/useTableView";

export function SavedViews({
  views,
  current,
  onSave,
  onRemove,
  onApply,
}: {
  views: SavedView[];
  current: Record<string, string>;
  onSave: (name: string, filters: Record<string, string>) => void;
  onRemove: (name: string) => void;
  onApply: (filters: Record<string, string>) => void;
}) {
  const [name, setName] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Dê um nome ao filtro.");
      return;
    }
    onSave(trimmed, current);
    setName("");
    toast.success(`Filtro “${trimmed}” salvo.`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Star className="mr-1.5 size-3.5" /> Filtros salvos
          {views.length > 0 && (
            <span className="num ml-1.5 rounded bg-muted px-1 text-[10px]">{views.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Meus filtros</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Nenhum filtro salvo ainda. Ajuste os filtros e salve abaixo.
          </p>
        )}
        {views.map((v) => (
          <DropdownMenuItem
            key={v.name}
            onClick={() => onApply(v.filters)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{v.name}</span>
            <button
              type="button"
              aria-label={`Excluir filtro ${v.name}`}
              className="text-muted-foreground transition-colors hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(v.name);
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-1.5 p-1.5">
          <Input
            className="h-8"
            placeholder="Nome do filtro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={save}>
            <BookmarkPlus className="size-3.5" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
