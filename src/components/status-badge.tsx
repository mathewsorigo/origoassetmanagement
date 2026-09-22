import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { agreementStatusLabel, assetStatusLabel, employeeStatusLabel } from "@/lib/format";

const tones: Record<string, string> = {
  disponivel: "bg-info/15 text-info border-info/30",
  em_uso: "bg-success/15 text-success border-success/30",
  manutencao: "bg-warning/20 text-warning-foreground border-warning/40",
  devolvido: "bg-muted text-muted-foreground border-border",
  extraviado: "bg-destructive/15 text-destructive border-destructive/30",
  rascunho: "bg-muted text-muted-foreground border-border",
  enviado: "bg-info/15 text-info border-info/30",
  visualizado: "bg-warning/20 text-warning-foreground border-warning/40",
  assinado: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/15 text-destructive border-destructive/30",
  expirado: "bg-destructive/10 text-destructive border-destructive/20",
  ativo: "bg-success/15 text-success border-success/30",
  inativo: "bg-muted text-muted-foreground border-border",
  afastado: "bg-warning/20 text-warning-foreground border-warning/40",
  encerrado: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ value }: { value: string }) {
  const label =
    assetStatusLabel[value] ??
    agreementStatusLabel[value] ??
    employeeStatusLabel[value] ??
    (value === "encerrado" ? "Encerrado" : value);
  return (
    <Badge variant="outline" className={cn("font-medium", tones[value])}>
      {label}
    </Badge>
  );
}
