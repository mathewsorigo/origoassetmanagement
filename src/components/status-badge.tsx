import { cn } from "@/lib/utils";
import { agreementStatusLabel, assetStatusLabel, employeeStatusLabel } from "@/lib/format";

const tones: Record<string, { chip: string; dot: string }> = {
  disponivel: { chip: "bg-info/8 text-info border-info/20", dot: "bg-info" },
  em_uso: { chip: "bg-success/8 text-success border-success/20", dot: "bg-success" },
  manutencao: {
    chip: "bg-warning/12 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  devolvido: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  extraviado: {
    chip: "bg-destructive/8 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  rascunho: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  enviado: { chip: "bg-info/8 text-info border-info/20", dot: "bg-info" },
  visualizado: {
    chip: "bg-warning/12 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  assinado: { chip: "bg-success/8 text-success border-success/20", dot: "bg-success" },
  recusado: {
    chip: "bg-destructive/8 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  expirado: {
    chip: "bg-destructive/8 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  ativo: { chip: "bg-success/8 text-success border-success/20", dot: "bg-success" },
  inativo: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  afastado: {
    chip: "bg-warning/12 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  encerrado: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  convidado: {
    chip: "bg-warning/12 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  desativado: {
    chip: "bg-destructive/8 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  vigente: { chip: "bg-success/8 text-success border-success/20", dot: "bg-success" },
  vencendo: {
    chip: "bg-warning/12 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  vencida: {
    chip: "bg-destructive/8 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  sem_prazo: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  aberta: { chip: "bg-info/8 text-info border-info/20", dot: "bg-info" },
  encerrada: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

const extraLabels: Record<string, string> = {
  solicitado: "Solicitação aceita",
  sucesso: "Concluído",
  pendente: "Pendente",
  erro: "Erro",
  vigente: "Vigente",
  vencendo: "Vencendo",
  vencida: "Vencida",
  sem_prazo: "Sem prazo",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const label =
    assetStatusLabel[value] ??
    agreementStatusLabel[value] ??
    employeeStatusLabel[value] ??
    extraLabels[value] ??
    (value === "encerrado" ? "Encerrado" : value);
  const tone = tones[value] ?? {
    chip: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone.chip,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {label}
    </span>
  );
}
