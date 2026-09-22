import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, isOperator, useRoles, useSession } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { tagTone, tagTones, useTags, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * Aplica etiquetas a um ou vários equipamentos e permite criar novas etiquetas.
 */
export function TagPicker({
  assetIds,
  open,
  onOpenChange,
}: {
  assetIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const admin = isAdmin(roles);
  const { data: tags } = useTags();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("turquesa");

  const { data: current } = useQuery({
    queryKey: ["asset-tags-selection", assetIds],
    enabled: open && assetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_tags")
        .select("asset_id,tag_id")
        .in("asset_id", assetIds);
      if (error) throw error;
      return data as Array<{ asset_id: string; tag_id: string }>;
    },
  });

  useEffect(() => {
    if (!open) return;
    const counts = new Map<string, number>();
    for (const row of current ?? []) counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
    const all = new Set<string>();
    counts.forEach((count, tagId) => {
      if (count === assetIds.length) all.add(tagId);
    });
    setSelected(all);
  }, [open, current, assetIds.length]);

  const createTag = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Informe o nome da etiqueta.");
      const { data, error } = await supabase
        .from("tags")
        .insert({ name, color: newColor })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({ action: "criar", entity: "tags", entityId: data.id, details: { name } });
    },
    onSuccess: () => {
      setNewName("");
      toast.success("Etiqueta criada.");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTag = useMutation({
    mutationFn: async (tag: Tag) => {
      const { error } = await supabase.from("tags").delete().eq("id", tag.id);
      if (error) throw error;
      await logAudit({
        action: "excluir",
        entity: "tags",
        entityId: tag.id,
        details: { name: tag.name },
      });
    },
    onSuccess: () => {
      toast.success("Etiqueta removida.");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["asset-tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const keep = [...selected];
      const { error: delError } = await supabase
        .from("asset_tags")
        .delete()
        .in("asset_id", assetIds);
      if (delError) throw delError;
      if (keep.length) {
        const rows = assetIds.flatMap((asset_id) => keep.map((tag_id) => ({ asset_id, tag_id })));
        const { error } = await supabase.from("asset_tags").insert(rows);
        if (error) throw error;
      }
      for (const assetId of assetIds) {
        await logAudit({
          action: "atualizar",
          entity: "assets",
          entityId: assetId,
          details: { etiquetas: keep.length },
        });
      }
    },
    onSuccess: () => {
      toast.success("Etiquetas atualizadas.");
      queryClient.invalidateQueries({ queryKey: ["asset-tags"] });
      queryClient.invalidateQueries({ queryKey: ["asset-tags-selection"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Tags className="size-4 text-primary" /> Etiquetas
          </DialogTitle>
          <DialogDescription>
            {assetIds.length > 1
              ? `As etiquetas escolhidas serão aplicadas aos ${assetIds.length} equipamentos selecionados.`
              : "Escolha as etiquetas deste equipamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {(tags ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada ainda.</p>
          )}
          {(tags ?? []).map((tag) => {
            const tone = tagTone(tag.color);
            const on = selected.has(tag.id);
            return (
              <div key={tag.id} className="flex items-center">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggle(tag.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    tone.className,
                    on ? "ring-2 ring-primary/40" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", tone.dot)} />
                  {tag.name}
                  {on && <Check className="size-3" />}
                </button>
                {admin && (
                  <button
                    type="button"
                    aria-label={`Excluir etiqueta ${tag.name}`}
                    className="ml-1 text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => removeTag.mutate(tag)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Nova etiqueta
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-40 flex-1"
                placeholder="Ex.: Diretoria"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tagTones).map(([value, tone]) => (
                    <SelectItem key={value} value={value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                onClick={() => createTag.mutate()}
                disabled={createTag.isPending}
              >
                <Plus className="mr-1.5 size-4" /> Criar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canEdit && assetIds.length > 0 && (
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Aplicar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
