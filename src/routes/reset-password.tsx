import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha · Órigo Ativos" },
      { name: "description", content: "Crie uma nova senha para acessar o Órigo Ativos." },
      { property: "og:title", content: "Definir senha · Órigo Ativos" },
      { property: "og:description", content: "Crie uma nova senha de acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Navigate to="/definir-senha" replace />,
});
