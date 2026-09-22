import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Órigo Ativos · Entrar" },
      {
        name: "description",
        content:
          "Sistema da Órigo Energia para gestão de notebooks e celulares, vínculos e termos de uso.",
      },
      { property: "og:title", content: "Órigo Ativos · Entrar" },
      {
        property: "og:description",
        content: "Gestão de equipamentos, vínculos e termos de responsabilidade da Órigo Energia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthScreen,
});
