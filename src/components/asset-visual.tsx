import { Laptop, Smartphone, Monitor, Cable, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { modelImage } from "@/lib/model-images";

const icons: Record<string, LucideIcon> = {
  notebook: Laptop,
  celular: Smartphone,
  monitor: Monitor,
  acessorio: Cable,
  outro: Package,
};

export function AssetIcon({
  type,
  model,
  className,
  size = "sm",
}: {
  type: string;
  model?: string | null | undefined;
  className?: string | undefined;
  size?: "sm" | "lg";
}) {
  const Icon = icons[type] ?? Package;
  const photo = modelImage(model);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10 text-primary",
        size === "lg" ? "size-16" : "size-9",
        className,
      )}
    >
      {photo ? (
        <img
          src={photo}
          alt={model ?? type}
          loading="lazy"
          className="size-full bg-white object-contain p-0.5"
        />
      ) : (
        <Icon className={size === "lg" ? "size-8" : "size-4"} />
      )}
    </span>
  );
}

export function SourceBadge({ intuneDeviceId }: { intuneDeviceId?: string | null | undefined }) {
  if (!intuneDeviceId) return null;
  return (
    <Badge variant="outline" className="border-accent/40 bg-accent/10 font-medium text-accent">
      Intune
    </Badge>
  );
}

export function FieldGrid({
  title,
  fields,
  columns = 4,
}: {
  title: string;
  fields: Array<[string, string | null | undefined]>;
  columns?: 2 | 3 | 4;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-4 py-2.5">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </header>
      <div
        className={cn(
          "grid gap-x-8 gap-y-4 px-4 py-4",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 break-words text-sm">{value || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
