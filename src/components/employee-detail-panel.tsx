import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/asset-visual";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsPanel } from "@/components/documents-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { isOperator, useRoles, useSession } from "@/hooks/useAuth";
import { employeeStatusLabel, formatDate } from "@/lib/format";
import { logAudit } from "@/lib/audit";

const emptyForm = {
  full_name: "",
  email: "",
  cpf: "",
  phone: "",
  job_title: "",
  department: "",
  unit: "",
  manager_name: "",
  status: "ativo",
};

type FormState = typeof emptyForm;

export function EmployeeDetailPanel({
  employeeId,
  onOpenChange,
  onNavigate,
}: {
  employeeId: string | null;
  onOpenChange: (open: boolean) => void;
  onNavigate?: ((direction: -1 | 1) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEdit = isOperator(roles);
  const open = !!employeeId;

  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [dirty, setDirty] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", employeeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["employee-history", employeeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, asset:assets(id,serial_number,brand,model,asset_type), agreements(id,status)")
        .eq("employee_id", employeeId!)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!employee) return;
    setForm({
      full_name: employee.full_name ?? "",
      email: employee.email ?? "",
      cpf: employee.cpf ?? "",
      phone: employee.phone ?? "",
      job_title: employee.job_title ?? "",
      department: employee.department ?? "",
      unit: employee.unit ?? "",
      manager_name: employee.manager_name ?? "",
      status: employee.status ?? "ativo",
    });
    setDirty(false);
  }, [employee]);

  useEffect(() => {
    if (!open || !onNavigate) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate!(1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate!(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNavigate]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!employeeId) return;
      if (!form.full_name.trim() || !form.email.trim())
        throw new Error("Nome e e-mail são obrigatórios.");
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          cpf: form.cpf || null,
          phone: form.phone || null,
          job_title: form.job_title || null,
          department: form.department || null,
          unit: form.unit || null,
          manager_name: form.manager_name || null,
          status: form.status as "ativo",
        })
        .eq("id", employeeId);
      if (error) throw error;
      await logAudit({
        action: "atualizar",
        entity: "employees",
        entityId: employeeId,
        details: { email: form.email },
      });
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado.");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (form.full_name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-6 pb-5 pt-6">
          <div className="flex items-start gap-4 pr-8">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-display text-lg font-semibold text-primary">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              {isLoading && !employee ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <h2 className="truncate font-display text-xl font-semibold tracking-tight">
                  {form.full_name || "Colaborador"}
                </h2>
              )}
              <p className="mt-1 truncate text-xs text-muted-foreground">{form.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {employee && <StatusBadge value={employee.status} />}
                {form.department && (
                  <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {form.department}
                  </span>
                )}
                {form.job_title && (
                  <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {form.job_title}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {onNavigate && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Anterior"
                  onClick={() => onNavigate(-1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Próximo"
                  onClick={() => onNavigate(1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            )}
            {employee && (
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to="/pessoas/$id" params={{ id: employee.id }}>
                  Abrir ficha completa <ExternalLink className="ml-2 size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Tabs defaultValue="dados">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">
                Dados
              </TabsTrigger>
              <TabsTrigger value="equipamentos" className="flex-1">
                Equipamentos
              </TabsTrigger>
              <TabsTrigger value="documentos" className="flex-1">
                Documentos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4 animate-in fade-in-50">
              {!canEdit && (
                <p className="mb-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Você tem acesso somente de consulta.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["full_name", "Nome completo"],
                    ["email", "E-mail corporativo"],
                    ["cpf", "CPF"],
                    ["phone", "Telefone"],
                    ["job_title", "Cargo"],
                    ["department", "Área"],
                    ["unit", "Unidade"],
                    ["manager_name", "Gestor"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      value={form[key]}
                      disabled={!canEdit}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Select
                    value={form.status}
                    disabled={!canEdit}
                    onValueChange={(v) => set("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(employeeStatusLabel).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="equipamentos" className="mt-4 space-y-2 animate-in fade-in-50">
              {(history ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum equipamento vinculado a esta pessoa.
                </p>
              )}
              {(history ?? []).map((h) => {
                const asset = h.asset as {
                  id: string;
                  serial_number: string;
                  brand: string | null;
                  model: string | null;
                  asset_type: string;
                } | null;
                const agreement = (
                  h.agreements as Array<{ id: string; status: string }> | null
                )?.[0];
                return (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AssetIcon type={asset?.asset_type ?? "outro"} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {`${asset?.brand ?? ""} ${asset?.model ?? ""}`.trim() ||
                            asset?.serial_number ||
                            "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Série {asset?.serial_number ?? "—"} · Entrega{" "}
                          {formatDate(h.assigned_at)}
                          {h.returned_at ? ` · Devolução ${formatDate(h.returned_at)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {agreement && <StatusBadge value={agreement.status} />}
                      <StatusBadge value={h.status} />
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="documentos" className="mt-4 animate-in fade-in-50">
              {employeeId && <DocumentsPanel filter={{ employeeId }} />}
            </TabsContent>
          </Tabs>
        </div>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {dirty ? "Alterações não salvas" : "Tudo salvo"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
                Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
