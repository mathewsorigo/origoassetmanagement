import { siBitdefender } from "simple-icons";
import { cn } from "@/lib/utils";

export function BitdefenderStatus({
  installed,
  className,
}: {
  installed?: boolean | null | undefined;
  className?: string | undefined;
}) {
  const label = installed ? "Bitdefender instalado" : "Bitdefender não detectado";
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground",
        installed && "text-destructive",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
        <path d={siBitdefender.path} />
      </svg>
    </span>
  );
}