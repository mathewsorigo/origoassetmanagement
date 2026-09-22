import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ShieldCheck, FileSignature, QrCode } from "lucide-react";
import { OrigoLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useAuth";

export function AuthBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2">
      {/* Coluna esquerda — dark, frase do sistema */}
      <aside className="dark relative hidden flex-col justify-between overflow-hidden bg-background px-10 py-12 text-foreground md:flex">
        {/* brilhos difusos da marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
          <div className="absolute -bottom-40 -right-24 h-80 w-80 rounded-full bg-accent/30 blur-[120px]" />
          <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-primary-glow/15 blur-[110px]" />
          {/* malha de pontos */}
          <div
            className="absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "radial-gradient(color-mix(in oklab, var(--foreground) 45%, transparent) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
              maskImage:
                "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative">
          <span className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/90">
            Órigo Ativos
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Gestão completa dos ativos de TI da Órigo — do vínculo à assinatura digital.
          </h2>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground">
            Cadastre equipamentos, vincule às pessoas, gere termos de uso e
            dispare para assinatura. Tudo centralizado, auditável e integrado.
          </p>

          <ul className="space-y-3 pt-2">
            <li className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              Inventário por tipo, localidade e contrato
            </li>
            <li className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSignature className="size-4" />
              </span>
              Termos de uso com assinatura digital
            </li>
            <li className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <QrCode className="size-4" />
              </span>
              Conferência por QR Code e inventário físico
            </li>
          </ul>
        </div>

        <div className="relative text-xs text-muted-foreground/80">
          © 2026 Órigo Energia · Órigo Ativos
        </div>
      </aside>

      {/* Coluna direita — branca, login */}
      <main className="relative flex items-center justify-center bg-white px-5 py-10 text-foreground">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export function AuthScreen() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/painel", replace: true });
  }, [loading, session, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  async function handleMicrosoft() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("microsoft", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Falha no login Microsoft", { description: String(result.error) });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel", replace: true });
  }

  async function handleReset() {
    if (!email) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) {
      toast.error("Não foi possível enviar o link", { description: error.message });
      return;
    }
    toast.success("Link enviado", {
      description: "Confira sua caixa de entrada e siga o link para criar uma nova senha.",
    });
  }

  return (
    <AuthBackdrop>
      <div className="animate-in fade-in-50 slide-in-from-bottom-3 duration-700">
        <div className="mb-8 flex flex-col items-center gap-3">
          <OrigoLogo className="h-24" />
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Gestão de ativos de TI
          </p>
        </div>

        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Acessar o sistema</h1>
          <p className="text-sm text-muted-foreground">
            Use seu e-mail corporativo. Novas contas são criadas pelo administrador.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full border-border/80 bg-transparent py-5 hover:bg-secondary/60"
          onClick={handleMicrosoft}
          disabled={busy}
          type="button"
        >
          <svg className="mr-2 size-4" viewBox="0 0 23 23" aria-hidden>
            <path fill="#f35325" d="M1 1h10v10H1z" />
            <path fill="#81bc06" d="M12 1h10v10H12z" />
            <path fill="#05a6f0" d="M1 12h10v10H1z" />
            <path fill="#ffba08" d="M12 12h10v10H12z" />
          </svg>
          Entrar com Microsoft
        </Button>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou com e-mail
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@origoenergia.com.br"
              className="h-11 rounded-xl border-border/60 bg-secondary/40 focus-visible:ring-primary/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-11 rounded-xl border-border/60 bg-secondary/40 focus-visible:ring-primary/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
            disabled={busy}
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground md:hidden">
          © 2026 Órigo Energia · Órigo Ativos
        </p>
      </div>
    </AuthBackdrop>
  );
}
