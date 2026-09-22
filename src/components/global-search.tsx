import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Laptop, Link2, Search, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { assetStatusLabel, assetTypeLabel } from "@/lib/format";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = term.trim();

  const { data } = useQuery({
    queryKey: ["global-search", query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      const like = `%${query}%`;
      const [assets, employees] = await Promise.all([
        supabase
          .from("assets")
          .select("id,brand,model,serial_number,patrimony,asset_type,status")
          .or(
            `serial_number.ilike.${like},brand.ilike.${like},model.ilike.${like},patrimony.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("employees")
          .select("id,full_name,email,department")
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .limit(6),
      ]);
      return {
        assets: assets.data ?? [],
        employees: employees.data ?? [],
      };
    },
  });

  function go(action: () => void) {
    setOpen(false);
    setTerm("");
    action();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="truncate">Encontre o que você procura…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Busque equipamentos, colaboradores…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          <CommandEmpty>
            {query.length < 2 ? "Digite ao menos 2 caracteres." : "Nada encontrado."}
          </CommandEmpty>

          {(data?.assets.length ?? 0) > 0 && (
            <CommandGroup heading="Equipamentos">
              {data!.assets.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`asset-${a.id}-${a.serial_number}`}
                  onSelect={() => go(() => navigate({ to: "/ativos/$id", params: { id: a.id } }))}
                >
                  <Laptop className="mr-2 size-4 text-primary" />
                  <span className="font-medium">
                    {`${a.brand ?? ""} ${a.model ?? ""}`.trim() || a.serial_number}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {assetTypeLabel[a.asset_type]} · {assetStatusLabel[a.status]} · Série{" "}
                    {a.serial_number}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(data?.employees.length ?? 0) > 0 && (
            <CommandGroup heading="Colaboradores">
              {data!.employees.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`employee-${e.id}-${e.email}`}
                  onSelect={() => go(() => navigate({ to: "/pessoas/$id", params: { id: e.id } }))}
                >
                  <Users className="mr-2 size-4 text-accent" />
                  <span className="font-medium">{e.full_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{e.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Ir para">
            <CommandItem value="ir-ativos" onSelect={() => go(() => navigate({ to: "/ativos" }))}>
              <Laptop className="mr-2 size-4" /> Ativos
            </CommandItem>
            <CommandItem value="ir-pessoas" onSelect={() => go(() => navigate({ to: "/pessoas" }))}>
              <Users className="mr-2 size-4" /> Colaboradores
            </CommandItem>
            <CommandItem
              value="ir-vinculos"
              onSelect={() => go(() => navigate({ to: "/vinculos" }))}
            >
              <Link2 className="mr-2 size-4" /> Vínculos
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
