import { useCallback, useEffect, useState } from "react";
import { takePendingQr } from "@/lib/pending-qr";
import { readAuthErrorFromUrl, takeAuthNotice } from "@/lib/auth-notice";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ShieldCheck, FileSignature, QrCode, Monitor } from "lucide-react";
import { OrigoLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useAuth";

export function AuthBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2">
      {/* Coluna esquerda — dark, frase do sistema */}
      <aside className="dark relative hidden flex-col items-center justify-center overflow-hidden bg-background px-10 py-12 text-foreground md:flex">
        {/* brilhos difusos da marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
          <div className="absolute -bottom-40 -right-24 h-80 w-80 rounded-full bg-accent/30 blur-[120px]" />
          <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-primary-glow/15 blur-[110px]" />
          {/* ícone de computador discreto cobrindo toda a área escura */}
          <Monitor
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground"
            style={{
              width: "min(90%, 44rem)",
              height: "min(90%, 44rem)",
              opacity: 0.045,
            }}
            strokeWidth={0.5}
          />
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

        <div className="absolute bottom-8 left-10 right-10 text-xs text-muted-foreground/80">
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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = readAuthErrorFromUrl();
    const fromApp = takeAuthNotice();
    const message = fromUrl ?? fromApp;
    if (message) setNotice(message);
  }, []);



  const goToApp = useCallback(() => {
    const pending = takePendingQr();
    if (pending) {
      navigate({ to: "/qr/$assetId", params: { assetId: pending }, replace: true });
      return;
    }
    navigate({ to: "/painel", replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!loading && session) goToApp();
  }, [loading, session, goToApp]);


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
    goToApp();
  }


  return (
    <AuthBackdrop>
      <div className="animate-in fade-in-50 slide-in-from-bottom-3 duration-700">
        <div className="mb-8 flex justify-center">
          <OrigoLogo className="h-24" />
        </div>

        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Acessar o sistema</h1>
          <p className="text-sm text-muted-foreground">
            Acesso restrito a e-mails @origoenergia.com.br previamente liberados pelo
            administrador.
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

        {busy && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Redirecionando para a Microsoft…
          </p>
        )}


        <p className="mt-8 text-center text-xs text-muted-foreground md:hidden">
          © 2026 Órigo Energia · Órigo Ativos
        </p>
      </div>
    </AuthBackdrop>
  );
}
