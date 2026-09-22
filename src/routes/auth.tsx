import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Órigo Ativos" },
      {
        name: "description",
        content: "Acesso restrito ao time da Órigo Energia para gestão de ativos de TI.",
      },
      { property: "og:title", content: "Entrar · Órigo Ativos" },
      { property: "og:description", content: "Acesso restrito ao time da Órigo Energia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthScreen,
});
