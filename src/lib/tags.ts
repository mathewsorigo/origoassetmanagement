import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const tagTones: Record<string, { label: string; className: string; dot: string }> = {
  turquesa: { label: "Turquesa", className: "bg-primary/12 text-primary border-primary/30", dot: "bg-primary" },
  roxo: { label: "Roxo", className: "bg-accent/15 text-accent border-accent/30", dot: "bg-accent" },
  verde: { label: "Verde", className: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  ambar: {
    label: "Âmbar",
    className: "bg-warning/25 text-warning-foreground border-warning/40",
    dot: "bg-warning",
  },
  azul: { label: "Azul", className: "bg-info/12 text-info border-info/30", dot: "bg-info" },
  vermelho: {
    label: "Vermelho",
    className: "bg-destructive/12 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export function tagTone(color?: string | null) {
  return tagTones[color ?? "turquesa"] ?? tagTones["turquesa"]!;
}

export type Tag = { id: string; name: string; color: string };

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("id,name,color").order("name");
      if (error) throw error;
      return data as Tag[];
    },
  });
}

export function useAssetTags() {
  return useQuery({
    queryKey: ["asset-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_tags")
        .select("asset_id, tag:tags(id,name,color)");
      if (error) throw error;
      const map = new Map<string, Tag[]>();
      for (const row of data as Array<{ asset_id: string; tag: Tag | null }>) {
        if (!row.tag) continue;
        const list = map.get(row.asset_id) ?? [];
        list.push(row.tag);
        map.set(row.asset_id, list);
      }
      return map;
    },
  });
}
