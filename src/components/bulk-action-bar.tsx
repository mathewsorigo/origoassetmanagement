import type { ReactNode } from "react";

export function BulkActionBar({
  count,
  total,
  noun,
  onClear,
  children,
}: {
  count: number;
  total: number;
  noun: string;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-card/95 px-4 py-3 shadow-[var(--shadow-elevated)] backdrop-blur animate-in fade-in-0 slide-in-from-bottom-4">
        <span className="text-sm font-medium">
          {count} de {total} {noun}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          limpar seleção
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
