import type { ReactNode } from "react";

export function DetailSection({
  title,
  children,
  columns = 2,
}: {
  title: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <header className="border-b bg-muted/40 px-4 py-2.5">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </header>
      <div className={columns === 1 ? "divide-y" : "grid sm:grid-cols-2 sm:gap-x-8"}>
        {children}
      </div>
    </section>
  );
}

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b px-4 py-2.5 last:border-b-0 sm:border-b">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium">{value || "—"}</span>
    </div>
  );
}
