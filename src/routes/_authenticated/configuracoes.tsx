import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListManager } from "@/components/list-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRoles, useSession, isAdmin, isOperator } from "@/hooks/useAuth";
import { roleLabel } from "@/lib/format";
import { tagTone, tagTones, useTags } from "@/lib/tags";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · Órigo Ativos" },
      {
        name: "description",
        content: "Minha conta, listas do sistema e preferências dos termos de responsabilidade.",
      },
      { property: "og:title", content: "Configurações · Órigo Ativos" },
      { property: "og:description", content: "Conta, listas do sistema e preferências de termos." },
    ],
  }),
  component: Configuracoes,
});

type TermSettings = {
  prazo_dias: number;
  email_assunto: string;
  email_mensagem: string;
  lembrete_dias: number;
  lembrete_ativo: boolean;
};

function Configuracoes() {
  const { user } = useSession();
  const { data: roles } = useRoles(user);
  const canEditLists = isOperator(roles);
  const admin = isAdmin(roles);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Sua conta, as listas usadas nos cadastros e as preferências dos termos."
      />

      <Tabs defaultValue="conta">
        <TabsList>
          <TabsTrigger value="conta">Minha conta</TabsTrigger>
          {canEditLists && <TabsTrigger value="listas">Listas do sistema</TabsTrigger>}
          {admin && <TabsTrigger value="termos">Preferências de termos</TabsTrigger>}
        </TabsList>

        <TabsContent value="conta" className="mt-4">
          <MinhaConta />
        </TabsContent>

        {canEditLists && (
          <TabsContent value="listas" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <ListManager
                table="locations"
                title="Localidades"
                description="Escritórios e unidades onde os equipamentos ficam."
                canEdit={canEditLists}
              />
              <ListManager
                table="departments"
                title="Departamentos"
                description="Áreas da empresa usadas no cadastro de pessoas."
                canEdit={canEditLists}
              />
              <ListManager
                table="vendors"
                title="Fornecedores"
                description="Empresas que fornecem ou alugam os equipamentos."
                canEdit={canEditLists}
              />
              <TagManager canEdit={canEditLists} canDelete={admin} />
            </div>
          </TabsContent>
        )}

        {admin && (
          <TabsContent value="termos" className="mt-4">
            <PreferenciasTermos />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MinhaConta() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const { data: roles } = useRoles(user);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", job_title: "" });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        job_title: profile.job_title ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name || null,
          phone: form.phone || null,
          job_title: form.job_title || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
      await logAudit({ action: "atualizar_perfil", entity: "profiles", entityId: user!.id });
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      // @ts-expect-error: aceito pelo servidor quando a troca exige a senha atual
      current_password: current,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível trocar a senha", { description: error.message });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Senha atualizada.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Meus dados</CardTitle>
          <CardDescription>Como você aparece para o restante do time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input
                id="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Papéis</Label>
            <div className="flex flex-wrap gap-1.5">
              {(roles ?? []).map((r) => (
                <Badge key={r} variant="outline">
                  {roleLabel[r]}
                </Badge>
              ))}
              {(roles ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">Sem papel definido</span>
              )}
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar dados
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Trocar senha</CardTitle>
          <CardDescription>Informe a senha atual para confirmar a alteração.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={changePassword}>
            <div className="space-y-2">
              <Label htmlFor="atual">Senha atual</Label>
              <Input
                id="atual"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova2">Repetir a nova senha</Label>
              <Input
                id="nova2"
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TagManager({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const queryClient = useQueryClient();
  const { data: tags } = useTags();
  const [name, setName] = useState("");
  const [color, setColor] = useState("turquesa");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tags").insert({ name: name.trim(), color });
      if (error) throw error;
      await logAudit({ action: "criar_etiqueta", entity: "tags", details: { name, color } });
    },
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Etiqueta criada.");
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "Já existe uma etiqueta com este nome." : e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
      await logAudit({ action: "excluir_etiqueta", entity: "tags", entityId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["asset-tags"] });
      toast.success("Etiqueta removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Etiquetas</CardTitle>
        <CardDescription>Marcadores coloridos aplicados aos equipamentos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input
              placeholder="Nome da etiqueta"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-2">
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tagTones).map(([key, tone]) => (
                    <SelectItem key={key} value={key}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="icon" aria-label="Criar etiqueta">
                <Plus className="size-4" />
              </Button>
            </div>
          </form>
        )}
        <ul className="divide-y rounded-lg border">
          {(tags ?? []).map((tag) => (
            <li key={tag.id} className="flex items-center gap-2 p-2 text-sm">
              <span className={`size-2.5 rounded-full ${tagTone(tag.color).dot}`} />
              <span className="flex-1 truncate">{tag.name}</span>
              {canDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  aria-label="Excluir etiqueta"
                  onClick={() => remove.mutate(tag.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
          {(tags ?? []).length === 0 && (
            <li className="p-3 text-center text-xs text-muted-foreground">
              Nenhuma etiqueta criada.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function PreferenciasTermos() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TermSettings | null>(null);
  const [templateDraft, setTemplateDraft] = useState<{ id: string; body: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["app-settings", "termos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "termos")
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as unknown as TermSettings;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "termos", value: draft as never, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
      await logAudit({ action: "atualizar_preferencias_termos", entity: "app_settings" });
    },
    onSuccess: () => {
      toast.success("Preferências salvas.");
      queryClient.invalidateQueries({ queryKey: ["app-settings", "termos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!templateDraft) return;
      const { error } = await supabase
        .from("agreement_templates")
        .update({ body: templateDraft.body, updated_at: new Date().toISOString() })
        .eq("id", templateDraft.id);
      if (error) throw error;
      await logAudit({
        action: "atualizar_modelo_termo",
        entity: "agreement_templates",
        entityId: templateDraft.id,
      });
    },
    onSuccess: () => {
      toast.success("Modelo de termo salvo.");
      setTemplateDraft(null);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Envio e cobrança de assinatura</CardTitle>
          <CardDescription>
            Prazo, mensagem do e-mail e aviso automático de termo pendente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prazo">Prazo para assinatura (dias)</Label>
              <Input
                id="prazo"
                type="number"
                min={1}
                value={draft?.prazo_dias ?? 7}
                onChange={(e) =>
                  setDraft({ ...(draft as TermSettings), prazo_dias: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lembrete">Lembrar após (dias sem assinar)</Label>
              <Input
                id="lembrete"
                type="number"
                min={1}
                value={draft?.lembrete_dias ?? 3}
                onChange={(e) =>
                  setDraft({ ...(draft as TermSettings), lembrete_dias: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto do e-mail</Label>
            <Input
              id="assunto"
              value={draft?.email_assunto ?? ""}
              onChange={(e) =>
                setDraft({ ...(draft as TermSettings), email_assunto: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem do e-mail</Label>
            <Textarea
              id="mensagem"
              className="min-h-28"
              value={draft?.email_mensagem ?? ""}
              onChange={(e) =>
                setDraft({ ...(draft as TermSettings), email_mensagem: e.target.value })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Aviso automático de termo pendente</p>
              <p className="text-xs text-muted-foreground">
                Destaca no painel e no menu os termos que passaram do prazo.
              </p>
            </div>
            <Switch
              checked={draft?.lembrete_ativo ?? true}
              onCheckedChange={(v) =>
                setDraft({ ...(draft as TermSettings), lembrete_ativo: v })
              }
            />
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar preferências
          </Button>
        </CardContent>
      </Card>

      {(templates ?? []).map((t) => (
        <Card key={t.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base">{t.name}</CardTitle>
                <CardDescription>
                  Use os marcadores entre chaves duplas; eles são substituídos pelos dados reais.
                </CardDescription>
              </div>
              {t.is_default && (
                <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
                  Padrão
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              className="min-h-80 font-mono text-xs"
              value={templateDraft?.id === t.id ? templateDraft.body : t.body}
              onChange={(e) => setTemplateDraft({ id: t.id, body: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Marcadores disponíveis: {"{{colaborador_nome}}"}, {"{{colaborador_cpf}}"},{" "}
              {"{{colaborador_email}}"}, {"{{colaborador_cargo}}"}, {"{{colaborador_area}}"},{" "}
              {"{{fornecedor}}"}, {"{{ativo_tipo}}"}, {"{{ativo_marca}}"}, {"{{ativo_modelo}}"},{" "}
              {"{{ativo_serie}}"}, {"{{ativo_patrimonio}}"}, {"{{ativo_imei}}"},{" "}
              {"{{condicao_entrega}}"}, {"{{data_entrega}}"}, {"{{data_hoje}}"}.
            </p>
            <Button
              onClick={() => saveTemplate.mutate()}
              disabled={templateDraft?.id !== t.id || saveTemplate.isPending}
            >
              Salvar modelo
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
