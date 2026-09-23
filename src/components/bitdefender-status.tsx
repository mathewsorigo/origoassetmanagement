import { siBitdefender } from "simple-icons";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function BitdefenderStatus({
  installed,
  withLabel = false,
  className,
}: {
  installed?: boolean | null | undefined;
  withLabel?: boolean | undefined;
  className?: string | undefined;
}) {
  const label = installed ? "Bitdefender instalado" : "Bitdefender não detectado";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            className={cn(
              "inline-flex items-center gap-1.5 text-muted-foreground",
              installed && "text-destructive",
              className,
            )}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
              <path d={siBitdefender.path} />
            </svg>
            {withLabel && <span className="text-xs font-medium">{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}