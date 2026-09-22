import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  FileSignature,
  FileCheck2,
  Paperclip,
  PenLine,
  PlusCircle,
  Wrench,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export type TimelineEvent = {
  id: string;
  at: string;
  kind: "criacao" | "vinculo" | "devolucao" | "termo" | "assinatura" | "documento" | "manutencao" | "alteracao";
  title: string;
  description?: string | null;
  by?: string | null;
};

const kinds: Record<TimelineEvent["kind"], { icon: LucideIcon; ring: string; text: string }> = {
  criacao: { icon: PlusCircle, ring: "border-primary/30 bg-primary/8", text: "text-primary" },
  vinculo: { icon: ArrowLeftRight, ring: "border-success/30 bg-success/8", text: "text-success" },
  devolucao: {
    icon: ArrowLeftRight,
    ring: "border-border bg-muted",
    text: "text-muted-foreground",
  },
  termo: { icon: FileSignature, ring: "border-info/30 bg-info/8", text: "text-info" },
  assinatura: { icon: FileCheck2, ring: "border-success/30 bg-success/8", text: "text-success" },
  documento: { icon: Paperclip, ring: "border-border bg-muted", text: "text-muted-foreground" },
  manutencao: {
    icon: Wrench,
    ring: "border-warning/40 bg-warning/10",
    text: "text-warning-foreground",
  },
  alteracao: { icon: PenLine, ring: "border-border bg-muted", text: "text-muted-foreground" },
};

function monthLabel(iso: string) {
  const d = new Date(iso);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function Timeline({
  events,
  loading,
}: {
  events: TimelineEvent[];
  loading?: boolean;
}) {
  const groups = useMemo(() => {
    const sorted = [...events]
      .filter((e) => Boolean(e.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const map = new Map<string, TimelineEvent[]>();
    for (const e of sorted) {
      const key = monthLabel(e.at);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem histórico ainda"
        description="Vínculos, termos, documentos e alterações aparecem aqui em ordem cronológica."
      />
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([month, list]) => (
        <section key={month}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {month}
          </p>
          <ol className="relative space-y-1 border-l pl-5">
            {list.map((e) => {
              const k = kinds[e.kind];
              return (
                <li key={e.id} className="relative py-1.5">
                  <span
                    className={cn(
                      "absolute -left-[31px] top-1.5 flex size-6 items-center justify-center rounded-full border",
                      k.ring,
                      k.text,
                    )}
                    aria-hidden
                  >
                    <k.icon className="size-3" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[13px] font-medium">{e.title}</p>
                    <span className="num text-[11px] text-muted-foreground">
                      {new Date(e.at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {e.description && (
                    <p className="text-xs text-muted-foreground">{e.description}</p>
                  )}
                  {e.by && <p className="text-[11px] text-muted-foreground/80">por {e.by}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
