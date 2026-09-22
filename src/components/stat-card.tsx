import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
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

const tones = {
  primary: { text: "text-primary", bg: "bg-primary" },
  success: { text: "text-success", bg: "bg-success" },
  info: { text: "text-info", bg: "bg-info" },
  warning: { text: "text-warning-foreground", bg: "bg-warning" },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  tone = "primary",
  to,
  search,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
  tone?: keyof typeof tones;
  to?: string;
  search?: Record<string, string>;
}) {
  const t = tones[tone];
  const body = (
    <Card className="group relative overflow-hidden transition-colors hover:border-primary/40">
      <span className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70", t.bg)} aria-hidden />
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="num mt-1.5 font-display text-[26px] leading-none font-semibold">
              <AnimatedNumber value={value} />
            </p>
          )}
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40",
            t.text,
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );

  if (!to) return body;
  return (
    <Link to={to} search={search as never} className="block">
      {body}
    </Link>
  );
}
