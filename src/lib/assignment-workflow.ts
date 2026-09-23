import { supabase } from "@/integrations/supabase/client";

// Uploads precede the database transaction; a failed transaction is reported
// separately so an attachment problem is never announced as a completed delivery.
export async function uploadChecklistPhotos(id: string, photos: File[]) {
  const paths: string[] = [];
  try {
    for (const photo of photos) {
      const path = `checklists/${id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("asset-documents").upload(path, photo);
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  } catch (error) {
    if (paths.length) await supabase.storage.from("asset-documents").remove(paths);
    throw error;
  }
}

export function localCalendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function assertChecklist(items: { ok: boolean | null }[]) {
  if (!items.length || items.some((i) => i.ok === null))
    throw new Error("Confirme cada item do checklist antes de continuar.");
}
