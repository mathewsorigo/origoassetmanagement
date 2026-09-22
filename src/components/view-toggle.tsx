import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: "table" | "cards";
  onChange: (mode: "table" | "cards") => void;
}) {
  const options = [
    { id: "table" as const, label: "Tabela", icon: Rows3 },
    { id: "cards" as const, label: "Cartões", icon: LayoutGrid },
  ];
  return (
    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={mode === o.id}
          title={o.label}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition-colors",
            mode === o.id
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <o.icon className="size-3.5" />
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
