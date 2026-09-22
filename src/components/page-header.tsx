import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  breadcrumb?: string | undefined;
}) {
  return (
    <div className="mb-5 border-b pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <nav className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Link to="/painel" className="transition-colors hover:text-foreground">
              Início
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground/70">{breadcrumb ?? title}</span>
          </nav>
          <h1 className="mt-1.5 font-display text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
