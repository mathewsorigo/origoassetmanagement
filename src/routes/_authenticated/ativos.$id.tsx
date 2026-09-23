import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AssetDetailPanel } from "@/components/asset-detail-panel";
export const Route = createFileRoute("/_authenticated/ativos/$id")({
  component: AssetPage,
  head: () => ({ meta: [{ title: "Ficha do ativo · Órigo Ativos" }] }),
});
function AssetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  return (
    <AssetDetailPanel
      key={id}
      assetId={id}
      onOpenChange={(open) => {
        if (!open) void navigate({ to: "/ativos" });
      }}
    />
  );
}
