import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
      <div className="relative pl-4">
        <span className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-1 rounded-full bg-gradient-to-b from-primary to-primary-glow" />
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
