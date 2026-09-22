import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { OrigoLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/definir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha · Órigo Ativos" },
      { name: "description", content: "Crie a sua senha de acesso ao Órigo Ativos." },
      { property: "og:title", content: "Definir senha · Órigo Ativos" },
      { property: "og:description", content: "Crie a sua senha de acesso." },
    ],
  }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<"checking" | "ok" | "expired">("checking");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session) return;
      setEmail(session.user.email ?? "");
      setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setEmail(data.session.user.email ?? "");
        setReady("ok");
      } else {
        setTimeout(() => {
          if (!cancelled) setReady((prev) => (prev === "ok" ? prev : "expired"));
        }, 2500);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar a senha", { description: error.message });
      return;
    }
    await supabase.from("profiles").update({ status: "ativo" }).eq("id", (await supabase.auth.getUser()).data.user!.id);
    toast.success("Senha definida", { description: "Bem-vindo ao Órigo Ativos." });
    navigate({ to: "/painel", replace: true });
  }

  async function askNewLink() {
    if (!email) {
      navigate({ to: "/auth" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) {
      toast.error("Não foi possível enviar o link", { description: error.message });
      return;
    }
    toast.success("Enviamos um novo link para o seu e-mail.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
        <div className="mb-6 flex justify-center">
          <OrigoLogo className="h-24" />
        </div>
        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader>
            <CardTitle className="font-display">Definir senha</CardTitle>
            <CardDescription>
              {ready === "expired"
                ? "Este link não é mais válido."
                : "Escolha uma senha com pelo menos 8 caracteres para acessar o sistema."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready === "checking" && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Validando o link...
              </div>
            )}

            {ready === "expired" && (
              <div className="space-y-4">
                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  O link de convite ou de redefinição expirou. Peça um novo link informando o seu
                  e-mail.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-novo">E-mail</Label>
                  <Input
                    id="email-novo"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={askNewLink} type="button">
                  Enviar novo link
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  type="button"
                  onClick={() => navigate({ to: "/auth" })}
                >
                  Voltar para o login
                </Button>
              </div>
            )}

            {ready === "ok" && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {email && (
                  <p className="text-xs text-muted-foreground">
                    Conta: <span className="font-medium text-foreground">{email}</span>
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha2">Repetir a senha</Label>
                  <Input
                    id="senha2"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar e entrar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
