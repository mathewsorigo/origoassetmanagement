import { OrigoSimbolo } from "@/components/brand-logo";
import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Laptop,
  Users,
  Link2,
  FileSignature,
  Upload,
  Plug,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRoles, useSession, isManager, isOperator, isAdmin } from "@/hooks/useAuth";
import { roleLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard, need: "any" },
  { to: "/ativos", label: "Ativos", icon: Laptop, need: "any" },
  { to: "/pessoas", label: "Colaboradores", icon: Users, need: "manager" },
  { to: "/vinculos", label: "Vínculos", icon: Link2, need: "any" },
  { to: "/termos", label: "Termos", icon: FileSignature, need: "any" },
  { to: "/importacao", label: "Importação", icon: Upload, need: "operator" },
  { to: "/integracoes", label: "Integrações", icon: Plug, need: "manager" },
  { to: "/administracao", label: "Administração", icon: Settings, need: "admin" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, need: "manager" },
] as const;

function AuthenticatedLayout() {
  const { session, user, loading } = useSession();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: roles } = useRoles(user);
  const { data: profile } = useProfile(user);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["agreements-pending-count"],
    enabled: !!session,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .in("status", ["rascunho", "enviado", "visualizado"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const visible = navItems.filter((item) => {
    if (item.need === "any") return true;
    if (item.need === "manager") return isManager(roles);
    if (item.need === "operator") return isOperator(roles);
    return isAdmin(roles);
  });

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-sidebar text-sidebar-foreground shadow-[var(--shadow-elevated)] transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <OrigoSimbolo />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Órigo Asset Management</p>
            <p className="text-[11px] text-sidebar-foreground/70">Gestão de equipamentos</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground before:opacity-100 font-medium",
              }}
              className="group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-all duration-200 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            >
              <item.icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
              {item.label}
              {item.to === "/termos" && pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium">
            {profile?.full_name ?? user?.email ?? "Usuário"}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/70">
            {roles?.map((r) => roleLabel[r]).join(", ") || "Sem papel definido"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-display text-sm font-semibold">Órigo Ativos</span>
        </header>
        <main key={pathname} className="min-w-0 flex-1 animate-in fade-in-50 slide-in-from-bottom-2 p-4 duration-300 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
