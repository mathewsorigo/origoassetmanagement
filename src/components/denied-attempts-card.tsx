import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import {
  addAllowedEmail,
  dismissDeniedAttempt,
  listDeniedAttempts,
} from "@/lib/admin-users.functions";

export function DeniedAttemptsCard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDeniedAttempts);
  const allowFn = useServerFn(addAllowedEmail);
  const dismissFn = useServerFn(dismissDeniedAttempt);

  const { data: rows } = useQuery({
    queryKey: ["denied-attempts"],
    queryFn: () => listFn(),
    staleTime: 30 * 1000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["denied-attempts"] });
    queryClient.invalidateQueries({ queryKey: ["allowed-emails"] });
    queryClient.invalidateQueries({ queryKey: ["access-users"] });
  };
  const fail = (e: Error) => toast.error("Não foi possível concluir", { description: e.message });

  const allowMutation = useMutation({
    mutationFn: (vars: { email: string; fullName: string | null }) =>
      allowFn({
        data: { email: vars.email, fullName: vars.fullName ?? "", roles: ["colaborador"] },
      }),
    onSuccess: () => {
      toast.success("E-mail liberado", { description: "A pessoa já pode entrar novamente." });
      refresh();
    },
    onError: fail,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: refresh,
    onError: fail,
  });

  if (!rows || rows.length === 0) return null;

  return (
    <Card className="mt-6 border-warning/40 p-4">
      <div className="mb-3 space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-warning-foreground" />
          Tentativas de acesso recusadas
        </h2>
        <CardDescription>
          Estas pessoas tentaram entrar com a conta Microsoft, mas o e-mail ainda não estava
          liberado. Libere aqui para dar acesso imediato.
        </CardDescription>
      </div>

      <ul className="divide-y divide-border/70">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <p className="font-medium">{r.email}</p>
              <p className="text-xs text-muted-foreground">
                {r.full_name ? `${r.full_name} · ` : ""}
                última tentativa em {formatDateTime(r.last_attempt_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {r.attempts} {r.attempts === 1 ? "tentativa" : "tentativas"}
              </Badge>
              <Button
                size="sm"
                onClick={() =>
                  allowMutation.mutate({ email: r.email, fullName: r.full_name })
                }
                disabled={allowMutation.isPending}
              >
                <Check className="mr-2 size-4" />
                Liberar este e-mail
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Descartar"
                onClick={() => dismissMutation.mutate(r.id)}
                disabled={dismissMutation.isPending}
              >
                <X className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
