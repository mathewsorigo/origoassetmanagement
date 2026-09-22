import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { OrigoLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useAuth";

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
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
        <div className="mb-6 flex items-center justify-center gap-3">
          <OrigoLogo className="h-24" />
        </div>

        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader>
            <CardTitle className="font-display">Acessar o sistema</CardTitle>
            <CardDescription>
              Use seu e-mail corporativo. Novas contas são criadas pelo administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleMicrosoft}
              disabled={busy}
              type="button"
            >
              Entrar com Microsoft
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou com e-mail
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Entrar
              </Button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Órigo Energia · Gestão de ativos de TI
        </p>
      </div>
    </div>
  );
}
