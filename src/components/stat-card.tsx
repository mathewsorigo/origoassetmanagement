import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AnimatedNumber({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown.toLocaleString("pt-BR")}</>;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
  tone?: "primary" | "success" | "info" | "warning";
}) {
  const tones = {
    primary: "from-primary/12 text-primary bg-primary",
    success: "from-success/15 text-success bg-success",
    info: "from-info/12 text-info bg-info",
    warning: "from-warning/25 text-warning-foreground bg-warning",
  } as const;

  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
      <span
        className={cn("absolute inset-y-0 left-0 w-1.5", tones[tone].split(" ")[2])}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70",
          tones[tone].split(" ")[0],
        )}
      />
      <CardContent className="relative flex items-center justify-between pt-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-14" />
          ) : (
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={value} />
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card/70 ring-1 ring-border/70 transition-transform duration-300 group-hover:scale-105",
            tones[tone].split(" ")[1],
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
