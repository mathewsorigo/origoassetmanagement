import { toast } from "sonner";
import { QueryError } from "@/components/query-error";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

export async function openDocument(path: string) {
  const { data, error } = await supabase.storage
    .from("asset-documents")
    .createSignedUrl(path, 60 * 5);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível abrir o documento.");
  window.open(data.signedUrl, "_blank", "noopener");
}

export function DocumentsPanel({ filter }: { filter: { employeeId?: string; assetId?: string } }) {
  const { data, isError, refetch } = useQuery({
    queryKey: ["documents", filter],
    queryFn: async () => {
      let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);
      if (filter.assetId) query = query.eq("asset_id", filter.assetId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isError) return <QueryError retry={refetch} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Documentos anexados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum documento anexado. Os termos assinados aparecem aqui automaticamente.
          </p>
        )}
        {(data ?? []).map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.kind === "termo_assinado" ? "Termo assinado" : doc.kind} ·{" "}
                  {formatDateTime(doc.created_at)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={"Abrir documento " + doc.file_name}
              onClick={() =>
                void openDocument(doc.storage_path).catch((e: Error) => toast.error(e.message))
              }
            >
              <Download className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
