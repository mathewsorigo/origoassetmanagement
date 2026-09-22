import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel, formatDate } from "@/lib/format";
import { SortableHead, TablePagination } from "@/components/data-table-ui";
import { AllowedEmailsCard } from "@/components/allowed-emails-card";
import { DeniedAttemptsCard } from "@/components/denied-attempts-card";
import { useTableState } from "@/hooks/useTableState";
import {
  listAccessUsers,
  revokeAccessUser,
  setAccessActive,
  setAccessRoles,
  type AdminRole,
  type AdminUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/administracao")({
  head: () => ({
    meta: [
      { title: "Acessos · Órigo Ativos" },
      {
        name: "description",
        content: "Convites, papéis e situação das contas que usam o sistema de ativos da Órigo.",
      },
      { property: "og:title", content: "Acessos · Órigo Ativos" },
      { property: "og:description", content: "Convites e papéis de acesso ao sistema." },
    ],
  }),
  component: Administracao,
});

const allRoles: AdminRole[] = ["admin", "ti", "gestor", "colaborador"];

const statusTone: Record<AdminUser["status"], string> = {
  ativo: "border-success/30 bg-success/15 text-success",
  convidado: "border-warning/40 bg-warning/25 text-warning-foreground",
  desativado: "border-destructive/30 bg-destructive/12 text-destructive",
};

const statusLabel: Record<AdminUser["status"], string> = {
  ativo: "Ativo",
  convidado: "Convite pendente",
  desativado: "Desativado",
};

function Administracao() {
  const queryClient = useQueryClient();
  const listUsers = useServerFn(listAccessUsers);
  const saveRoles = useServerFn(setAccessRoles);
  const setActive = useServerFn(setAccessActive);
  const revoke = useServerFn(revokeAccessUser);

  const [rolesTarget, setRolesTarget] = useState<AdminUser | null>(null);
  const [rolesDraft, setRolesDraft] = useState<AdminRole[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["access-users"],
    queryFn: () => listUsers(),
    staleTime: 60 * 1000,
  });

  const table = useTableState(users, {
    key: "acessos",
    accessors: {
      pessoa: (u) => u.full_name ?? u.email,
      situacao: (u) => u.status,
      convite: (u) => u.invited_at,
      ultimo: (u) => u.last_sign_in_at,
    },
    defaultSort: { key: "pessoa", dir: "asc" },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["access-users"] });
  const fail = (e: Error) => toast.error("Não foi possível concluir", { description: e.message });

  const rolesMutation = useMutation({
    mutationFn: () => saveRoles({ data: { userId: rolesTarget!.id, roles: rolesDraft } }),
    onSuccess: () => {
      toast.success("Papéis atualizados.");
      setRolesTarget(null);
      refresh();
    },
    onError: fail,
  });

  const activeMutation = useMutation({
    mutationFn: (input: { userId: string; active: boolean }) => setActive({ data: input }),
    onSuccess: (_d, input) => {
      toast.success(input.active ? "Acesso reativado." : "Acesso desativado.");
      refresh();
    },
    onError: fail,
  });

  const deleteMutation = useMutation({
    mutationFn: () => revoke({ data: { userId: deleteTarget!.id } }),
    onSuccess: () => {
      toast.success("Acesso removido.");
      setDeleteTarget(null);
      refresh();
    },
    onError: fail,
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Acessos"
        title="Acessos"
        description="Libere e-mails corporativos, defina o que cada pessoa pode fazer e controle contas ativas."
      />

      <Card className="overflow-x-auto p-4">
        <CardDescription className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Apenas administradores criam acessos. Não existe cadastro por conta própria.
        </CardDescription>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                columnKey="pessoa"
                label="Pessoa"
                sortKey={table.sortKey}
                sortDir={table.sortDir}
                onToggle={table.toggleSort}
              />
              <SortableHead
                columnKey="situacao"
                label="Situação"
                sortKey={table.sortKey}
                sortDir={table.sortDir}
                onToggle={table.toggleSort}
              />
              <TableHead>Papéis</TableHead>
              <SortableHead
                columnKey="convite"
                label="Convite"
                sortKey={table.sortKey}
                sortDir={table.sortDir}
                onToggle={table.toggleSort}
              />
              <SortableHead
                columnKey="ultimo"
                label="Último acesso"
                sortKey={table.sortKey}
                sortDir={table.sortDir}
                onToggle={table.toggleSort}
              />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {table.pageRows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-sm">
                  <p className="font-medium">{u.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusTone[u.status]}>
                    {statusLabel[u.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="outline">
                        {roleLabel[r]}
                      </Badge>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sem papel</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.invited_at ? formatDate(u.invited_at) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "Nunca acessou"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Ações">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setRolesTarget(u);
                          setRolesDraft(u.roles);
                        }}
                      >
                        <ShieldCheck className="mr-2 size-4" />
                        Alterar papéis
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.status === "desativado" ? (
                        <DropdownMenuItem
                          onSelect={() => activeMutation.mutate({ userId: u.id, active: true })}
                        >
                          <UserCheck className="mr-2 size-4" />
                          Reativar acesso
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => activeMutation.mutate({ userId: u.id, active: false })}
                        >
                          <UserX className="mr-2 size-4" />
                          Desativar acesso
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        {u.status === "convidado" ? "Cancelar convite" : "Excluir acesso"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && table.total === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum acesso cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          className="-mx-4 mt-3 px-4"
          noun="acessos"
          total={table.total}
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          page={table.page}
          pageCount={table.pageCount}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>

      <DeniedAttemptsCard />

      <AllowedEmailsCard />


      <Dialog open={!!rolesTarget} onOpenChange={(v) => !v && setRolesTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Papéis de {rolesTarget?.full_name}</DialogTitle>
            <DialogDescription>
              Administrador gerencia acessos; TI cadastra e vincula; Gestor acompanha; Colaborador
              apenas consulta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {allRoles.map((role) => (
              <label key={role} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <Checkbox
                  checked={rolesDraft.includes(role)}
                  onCheckedChange={(v) =>
                    setRolesDraft(
                      v ? [...rolesDraft, role] : rolesDraft.filter((r) => r !== role),
                    )
                  }
                />
                {roleLabel[role]}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => rolesMutation.mutate()} disabled={rolesMutation.isPending}>
              {rolesMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar papéis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o acesso de {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta e os papéis são apagados. O histórico de equipamentos e termos continua no
              sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Remover acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
