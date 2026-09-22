import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type IntegrationState = "conectada" | "nao_configurada" | "erro" | "desativada";

const states: Record<IntegrationState, { label: string; icon: LucideIcon; chip: string }> = {
  conectada: {
    label: "Conectada",
    icon: CheckCircle2,
    chip: "border-success/30 bg-success/10 text-success",
  },
  erro: {
    label: "Com erro",
    icon: AlertTriangle,
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  nao_configurada: {
    label: "Não configurada",
    icon: Clock,
    chip: "border-border bg-muted text-muted-foreground",
  },
  desativada: {
    label: "Desativada",
    icon: Clock,
    chip: "border-border bg-muted text-muted-foreground",
  },
};

export function IntegrationCard({
  title,
  description,
  urlLabel,
  icon: Icon = PlugZap,
  state,
  enabled,
  value,
  lastSyncAt,
  lastMessage,
  lastItems,
  canEdit,
  busy,
  onValueChange,
  onSaveUrl,
  onToggle,
  onTest,
  onSync,
  missing,
}: {
  title: string;
  description: string;
  urlLabel: string;
  icon?: LucideIcon | undefined;
  state: IntegrationState;
  enabled: boolean;
  value: string;
  lastSyncAt: string | null;
  lastMessage?: string | null | undefined;
  lastItems?: number | null | undefined;
  canEdit: boolean;
  busy?: "teste" | "sync" | null | undefined;
  onValueChange: (v: string) => void;
  onSaveUrl: () => void;
  onToggle: (v: boolean) => void;
  onTest: () => void;
  onSync: () => void;
  missing?: string[] | undefined;
}) {
  const s = states[state];
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-md border bg-muted/40 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              s.chip,
            )}
          >
            <s.icon className="size-3" />
            {s.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-2.5 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Última sincronização
            </p>
            <p className="num">{lastSyncAt ? formatDateTime(lastSyncAt) : "nunca"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Itens na última execução
            </p>
            <p className="num">{lastItems ?? "—"}</p>
          </div>
        </div>

        {lastMessage && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{lastMessage}</p>
        )}

        {missing && missing.length > 0 && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs">
            <p className="font-medium">Falta preencher</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">{urlLabel}</Label>
          <Input
            value={value}
            disabled={!canEdit}
            placeholder="https://"
            onChange={(e) => onValueChange(e.target.value)}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} disabled={!canEdit} onCheckedChange={onToggle} />
            <span className="text-xs text-muted-foreground">Ativa</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={onSaveUrl}>
                Salvar
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!canEdit || busy === "teste"} onClick={onTest}>
              {busy === "teste" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PlugZap className="size-3.5" />
              )}
              Testar conexão
            </Button>
            <Button size="sm" disabled={!canEdit || busy === "sync"} onClick={onSync}>
              {busy === "sync" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
