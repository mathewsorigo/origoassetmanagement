import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type ChecklistItem = { label: string; ok: boolean };

export const DEFAULT_CHECKLIST_ITEMS = [
  "Liga e funciona",
  "Tela intacta",
  "Teclado/touch funcionando",
  "Carregador incluso",
  "Acessórios completos",
];

export function emptyChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_ITEMS.map((label) => ({ label, ok: true }));
}

export function ChecklistFields({
  items,
  onChange,
  photos,
  onPhotos,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  photos: File[];
  onPhotos: (photos: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <Label>Checklist de condição</Label>
      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <label
            key={item.label}
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90"
          >
            <Checkbox
              checked={item.ok}
              onCheckedChange={(checked) => {
                const next = [...items];
                next[index] = { ...item, ok: checked === true };
                onChange(next);
              }}
            />
            {item.label}
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onPhotos([...photos, ...files]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
        >
          <Camera className="size-3.5" /> Anexar fotos do estado do equipamento (opcional)
        </button>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {photos.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px]"
              >
                {file.name}
                <button
                  type="button"
                  aria-label="Remover foto"
                  onClick={() => onPhotos(photos.filter((_, i) => i !== index))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Sobe as fotos para o bucket e grava o checklist do vínculo. */
export async function saveAssignmentChecklist({
  assignmentId,
  kind,
  items,
  photos,
  userId,
}: {
  assignmentId: string;
  kind: "entrega" | "devolucao";
  items: ChecklistItem[];
  photos: File[];
  userId: string | null | undefined;
}) {
  const paths: string[] = [];
  for (const photo of photos) {
    const path = `checklists/${assignmentId}/${Date.now()}-${photo.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage
      .from("asset-documents")
      .upload(path, photo, { upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  const { error } = await supabase.from("assignment_checklists").insert({
    assignment_id: assignmentId,
    kind,
    items,
    photos: paths,
    created_by: userId ?? null,
  });
  if (error) throw error;
}
