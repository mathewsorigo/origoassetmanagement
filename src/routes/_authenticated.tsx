import { OrigoSimbolo } from "@/components/brand-logo";
import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ShieldCheck,
  ScrollText,
  LogOut,
  Menu,
  Loader2,
  Plus,
  Tags,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/global-search";
import { TagPicker } from "@/components/tag-picker";
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
  { to: "/pessoas", label: "Pessoas", icon: Users, need: "manager" },
  { to: "/vinculos", label: "Vínculos", icon: Link2, need: "any" },
  { to: "/termos", label: "Termos", icon: FileSignature, need: "any" },
  { to: "/importacao", label: "Importar", icon: Upload, need: "operator" },
  { to: "/integracoes", label: "Integrar", icon: Plug, need: "manager" },
  { to: "/administracao", label: "Admin", icon: Settings, need: "admin" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, need: "manager" },
] as const;

function AuthenticatedLayout() {
  const { session, user, loading } = useSession();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: roles } = useRoles(user);
  const { data: profile } = useProfile(user);
  const [open, setOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
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
    await queryClient.cancelQueries();
    queryClient.clear();
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

  const canEdit = isOperator(roles);
  const initials = (profile?.full_name ?? user?.email ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Trilha de ícones */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[92px] shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-[var(--shadow-elevated)] transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <Link to="/painel" onClick={() => setOpen(false)} aria-label="Painel">
            <OrigoSimbolo />
          </Link>
          <button
            aria-label="Fechar menu"
            className="absolute right-2 top-5 text-sidebar-foreground/70 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground before:opacity-100",
              }}
              className="group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl px-1 py-2.5 text-[10.5px] font-medium text-sidebar-foreground/80 transition-all duration-200 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            >
              <span className="relative">
                <item.icon className="size-[22px] transition-transform duration-200 group-hover:scale-110" />
                {item.to === "/termos" && pendingCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-sidebar-primary px-1 text-center text-[9px] font-bold leading-4 text-sidebar-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0 max-w-xl flex-1">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 size-4" /> Novo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Cadastrar</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/ativos" })}>
                    <Laptop className="mr-2 size-4" /> Equipamento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/pessoas" })}>
                    <Users className="mr-2 size-4" /> Colaborador
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/vinculos" })}>
                    <Link2 className="mr-2 size-4" /> Vínculo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="outline"
              size="icon"
              aria-label="Etiquetas"
              onClick={() => setTagsOpen(true)}
            >
              <Tags className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary ring-1 ring-primary/25 transition-transform hover:scale-105"
                  aria-label="Minha conta"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="truncate text-sm">{profile?.full_name ?? user?.email}</p>
                  <p className="truncate text-[11px] font-normal text-muted-foreground">
                    {roles?.map((r) => roleLabel[r]).join(", ") || "Sem papel definido"}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/painel" })}>
                  <LayoutDashboard className="mr-2 size-4" /> Painel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                  <Settings className="mr-2 size-4" /> Configurações
                </DropdownMenuItem>
                {isAdmin(roles) && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/administracao" })}>
                    <ShieldCheck className="mr-2 size-4" /> Acessos
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <TagPicker assetIds={[]} open={tagsOpen} onOpenChange={setTagsOpen} />
    </div>
  );
}
