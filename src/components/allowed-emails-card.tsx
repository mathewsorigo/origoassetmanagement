import { QueryError } from "@/components/query-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/format";
import {
  ALLOWED_EMAIL_DOMAIN,
  addAllowedEmail,
  listAllowedEmails,
  removeAllowedEmail,
  type AdminRole,
  type AllowedEmail,
} from "@/lib/admin-users.functions";

const allRoles: AdminRole[] = ["admin", "ti", "gestor", "colaborador"];

export function AllowedEmailsCard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAllowedEmails);
  const addFn = useServerFn(addAllowedEmail);
  const removeFn = useServerFn(removeAllowedEmail);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roles, setRoles] = useState<AdminRole[]>(["colaborador"]);
  const [removeTarget, setRemoveTarget] = useState<AllowedEmail | null>(null);

  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["allowed-emails"],
    queryFn: () => listFn(),
    staleTime: 60 * 1000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["allowed-emails"] });
    queryClient.invalidateQueries({ queryKey: ["access-users"] });
  };
  const fail = (e: Error) => toast.error("Não foi possível concluir", { description: e.message });

  const addMutation = useMutation({
    mutationFn: () => addFn({ data: { email, fullName, roles } }),
    onSuccess: () => {
      toast.success("E-mail liberado", {
        description: "A pessoa já pode entrar com a conta Microsoft dela.",
      });
      setEmail("");
      setFullName("");
      setRoles(["colaborador"]);
      refresh();
    },
    onError: fail,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFn({ data: { email: removeTarget!.email } }),
    onSuccess: () => {
      toast.success("Liberação removida.");
      setRemoveTarget(null);
      refresh();
    },
    onError: fail,
  });

  if (isError) return <QueryError retry={refetch} />;
  return (
    <Card className="mt-6 p-4">
      <div className="mb-3 space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="size-4 text-primary" />
          E-mails liberados para entrar
        </h2>
        <CardDescription>
          Só quem estiver nesta lista consegue acessar, e apenas com e-mail @{ALLOWED_EMAIL_DOMAIN}.
          Qualquer outra conta é recusada no momento do login, mesmo pelo botão da Microsoft. Libere
          o e-mail <strong>antes</strong> de pedir para a pessoa entrar: quem tentar sem liberação
          recebe um aviso na tela de login e aparece aqui em "Tentativas recusadas".
        </CardDescription>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg border border-border/70 bg-secondary/30 p-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label
            htmlFor="allow-email"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            E-mail corporativo
          </Label>
          <Input
            id="allow-email"
            type="email"
            placeholder={`nome@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="allow-name"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Nome (opcional)
          </Label>
          <Input
            id="allow-name"
            placeholder="Nome da pessoa"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!email || addMutation.isPending}
          className="md:mb-0.5"
        >
          {addMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Plus className="mr-2 size-4" />
          )}
          Liberar acesso
        </Button>
        <div className="flex flex-wrap items-center gap-4 md:col-span-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Papéis</span>
          {allRoles.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roles.includes(r)}
                onCheckedChange={(v) =>
                  setRoles((prev) => (v ? [...prev, r] : prev.filter((x) => x !== r)))
                }
              />
              {roleLabel[r]}
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Papéis previstos</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  <p className="font-medium">{r.email}</p>
                  {r.full_name && <p className="text-xs text-muted-foreground">{r.full_name}</p>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {roleLabel[role]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      r.has_account
                        ? "border-success/30 bg-success/15 text-success"
                        : "border-warning/40 bg-warning/25 text-warning-foreground"
                    }
                  >
                    {r.has_account ? "Já acessou / conta criada" : "Aguardando primeiro acesso"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label="Remover liberação"
                    onClick={() => setRemoveTarget(r)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum e-mail liberado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover liberação?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.email} não conseguirá mais criar acesso pelo login da Microsoft. Contas
              já criadas continuam existindo — para bloquear de vez, desative a conta na lista
              acima.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeMutation.mutate();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
