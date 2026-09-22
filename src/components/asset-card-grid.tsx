import type { ReactNode } from "react";
import { AssetIcon, SourceBadge } from "@/components/asset-visual";
import { StatusBadge } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { assetTypeLabel, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AssetCardItem = {
  id: string;
  asset_type: string;
  brand?: string | null;
  model?: string | null;
  serial_number: string;
  patrimony?: string | null;
  status: string;
  location?: string | null;
  supplier?: string | null;
  lease_end?: string | null;
  intune_device_id?: string | null;
};

export function AssetCardGrid({
  items,
  selectedId,
  checked,
  onOpen,
  onToggleCheck,
  tagsOf,
  holderOf,
  actions,
}: {
  items: AssetCardItem[];
  selectedId?: string | null;
  checked: Set<string>;
  onOpen: (id: string) => void;
  onToggleCheck: (id: string) => void;
  tagsOf: (id: string) => Array<{ id: string; name: string; color: string }>;
  holderOf: (id: string) => string | null;
  actions?: (item: AssetCardItem) => ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((a) => {
        const holder = holderOf(a.id);
        const tags = tagsOf(a.id);
        return (
          <article
            key={a.id}
            onClick={() => onOpen(a.id)}
            className={cn(
              "group cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:border-primary/40",
              selectedId === a.id && "border-primary/60 ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-start gap-3">
              <span onClick={(e) => e.stopPropagation()} className="pt-1">
                <Checkbox
                  checked={checked.has(a.id)}
                  onCheckedChange={() => onToggleCheck(a.id)}
                  aria-label="Selecionar equipamento"
                />
              </span>
              <AssetIcon type={a.asset_type} model={a.model} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {`${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number}
                </p>
                <p className="num truncate text-xs text-muted-foreground">
                  {assetTypeLabel[a.asset_type] ?? a.asset_type} · {a.serial_number}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge value={a.status} />
                  <SourceBadge intuneDeviceId={a.intune_device_id} />
                </div>
              </div>
              <span onClick={(e) => e.stopPropagation()}>{actions?.(a)}</span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Responsável
                </dt>
                <dd className="truncate">{holder ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Localidade
                </dt>
                <dd className="truncate">{a.location || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Fornecedor
                </dt>
                <dd className="truncate">{a.supplier || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Locação até
                </dt>
                <dd className="num truncate">{a.lease_end ? formatDate(a.lease_end) : "—"}</dd>
              </div>
            </dl>

            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <TagBadge key={t.id} tag={t} />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
