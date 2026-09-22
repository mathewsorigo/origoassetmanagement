import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/administracao")({
  head: () => ({
    meta: [
      { title: "Administração · Órigo Ativos" },
      {
        name: "description",
        content: "Gestão de acessos, papéis e modelo do termo de responsabilidade.",
      },
      { property: "og:title", content: "Administração · Órigo Ativos" },
      { property: "og:description", content: "Papéis de acesso e modelo de termo." },
    ],
  }),
  component: Administracao,
});

const allRoles = ["admin", "ti", "gestor", "colaborador"] as const;

function Administracao() {
  const queryClient = useQueryClient();
  const [templateDraft, setTemplateDraft] = useState<{ id: string; body: string } | null>(null);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("*"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      return (profiles.data ?? []).map((p) => ({
        ...p,
        roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleRole = useMutation({
    mutationFn: async (input: { userId: string; role: (typeof allRoles)[number]; has: boolean }) => {
      if (input.has) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", input.userId)
          .eq("role", input.role);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: input.userId, role: input.role });
        if (error) throw error;
      }
      await logAudit({
        action: input.has ? "remover_papel" : "conceder_papel",
        entity: "user_roles",
        entityId: input.userId,
        details: { role: input.role },
      });
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
    <div>
      <PageHeader
        title="Administração"
        description="Controle de acessos e o modelo do termo preenchido automaticamente."
      />

      <Tabs defaultValue="acessos">
        <TabsList>
          <TabsTrigger value="acessos">Acessos e papéis</TabsTrigger>
          <TabsTrigger value="termo">Modelo do termo</TabsTrigger>
        </TabsList>

        <TabsContent value="acessos" className="mt-4">
          <Card className="overflow-x-auto p-4">
            <CardDescription className="mb-3">
              O primeiro usuário cadastrado recebe o papel de administrador. Novos acessos são
              criados na tela de login e liberados aqui.
            </CardDescription>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  {allRoles.map((r) => (
                    <TableHead key={r}>{roleLabel[r]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{u.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    {allRoles.map((role) => {
                      const has = u.roles.includes(role);
                      return (
                        <TableCell key={role}>
                          <Checkbox
                            checked={has}
                            onCheckedChange={() =>
                              toggleRole.mutate({ userId: u.id, role, has })
                            }
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {(users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum usuário cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="termo" className="mt-4 space-y-4">
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
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={t.name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <Textarea
                    className="min-h-80 font-mono text-xs"
                    value={templateDraft?.id === t.id ? templateDraft.body : t.body}
                    onChange={(e) => setTemplateDraft({ id: t.id, body: e.target.value })}
                  />
                </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
