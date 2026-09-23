import { QueryError } from "@/components/query-error";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

type ListTable = "locations" | "departments" | "vendors";

export function ListManager({
  table,
  title,
  description,
  canEdit,
}: {
  table: ListTable;
  title: string;
  description: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [table],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from(table).insert({ name });
      if (error) throw error;
      await logAudit({ action: "criar_item_lista", entity: table, details: { name } });
    },
    onSuccess: () => {
      setNewName("");
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Item adicionado.");
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "Este nome já existe nesta lista." : e.message),
  });

  const rename = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from(table).update({ name: input.name }).eq("id", input.id);
      if (error) throw error;
      await logAudit({
        action: "renomear_item_lista",
        entity: table,
        entityId: input.id,
        details: { name: input.name },
      });
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Nome atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await logAudit({ action: "excluir_item_lista", entity: table, entityId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Item removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isError) return <QueryError retry={refetch} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) create.mutate(newName.trim());
            }}
          >
            <Input
              placeholder="Adicionar..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" size="icon" disabled={create.isPending} aria-label="Adicionar">
              <Plus className="size-4" />
            </Button>
          </form>
        )}

        <ul className="divide-y rounded-lg border">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="p-2.5">
                <Skeleton className="h-4 w-32" />
              </li>
            ))}
          {(data ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-2 p-2 text-sm">
              {editing?.id === item.id ? (
                <>
                  <Input
                    className="h-8"
                    value={editing.name}
                    onChange={(e) => setEditing({ id: item.id, name: e.target.value })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Salvar"
                    onClick={() => rename.mutate({ id: item.id, name: editing.name.trim() })}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Cancelar"
                    onClick={() => setEditing(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate">{item.name}</span>
                  {canEdit && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground"
                        aria-label="Renomear"
                        onClick={() => setEditing({ id: item.id, name: item.name })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        aria-label="Excluir"
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
          {!isLoading && (data ?? []).length === 0 && (
            <li className="p-3 text-center text-xs text-muted-foreground">
              Nenhum item cadastrado.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
