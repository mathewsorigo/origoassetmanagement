import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Laptop, Smartphone, FileSignature, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Órigo Ativos — Gestão de notebooks e celulares" },
      {
        name: "description",
        content:
          "Sistema interno da Órigo Energia para controlar equipamentos alugados, vincular ativos a colaboradores e coletar assinatura do termo de uso.",
      },
      { property: "og:title", content: "Órigo Ativos — Gestão de notebooks e celulares" },
      {
        property: "og:description",
        content: "Inventário, vínculos, termos assinados e integrações em um só lugar.",
      },
    ],
  }),
  component: Index,
});

const highlights = [
  {
    icon: Laptop,
    title: "Inventário completo",
    text: "Notebooks, celulares e acessórios com série, patrimônio, contrato e custo de locação.",
  },
  {
    icon: Smartphone,
    title: "Vínculo por pessoa",
    text: "Saiba exatamente quem está com cada equipamento e todo o histórico de movimentações.",
  },
  {
    icon: FileSignature,
    title: "Termo assinado",
    text: "O termo de uso é gerado automaticamente e enviado para assinatura eletrônica.",
  },
  {
    icon: ShieldCheck,
    title: "Controle e auditoria",
    text: "Papéis de acesso, trilha de auditoria e importação em massa por planilha.",
  },
];

function Index() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/painel", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-primary-foreground">
            Ó
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">Órigo Ativos</p>
            <p className="text-xs text-muted-foreground">Gestão de equipamentos</p>
          </div>
        </div>
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-10 py-14 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Uso interno · Órigo Energia
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
              Cada equipamento com um responsável e um termo assinado.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground">
              Centralize os notebooks e celulares locados, vincule cada máquina ao colaborador e
              dispare o termo de uso para assinatura sem planilha paralela.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Acessar o sistema <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((h) => (
                <div key={h.title} className="rounded-xl border bg-background p-4">
                  <h.icon className="size-5 text-primary" />
                  <p className="mt-3 font-display text-sm font-semibold">{h.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{h.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
