import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminRole = "admin" | "ti" | "gestor" | "colaborador";
const ROLES: AdminRole[] = ["admin", "ti", "gestor", "colaborador"];

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  status: "ativo" | "convidado" | "desativado";
  invited_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  roles: AdminRole[];
};

function parseRoles(input: unknown): AdminRole[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is AdminRole => ROLES.includes(r as AdminRole));
}

async function assertAdmin(context: { supabase: ReturnType<typeof Object>; userId: string }) {
  const client = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data } = await client.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Apenas administradores podem gerenciar acessos.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function writeAudit(
  actorId: string,
  actorEmail: string | null,
  action: string,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  const db = await admin();
  await db.from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    entity: "acessos",
    entity_id: entityId,
    details: details as never,
  });
}

export const listAccessUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context as never);
    const db = await admin();

    const [{ data: profiles }, { data: roles }, authList] = await Promise.all([
      db.from("profiles").select("*").order("full_name", { nullsFirst: false }),
      db.from("user_roles").select("user_id, role"),
      db.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const authById = new Map(
      (authList.data?.users ?? []).map((u) => [
        u.id,
        { last_sign_in_at: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at },
      ]),
    );

    return (profiles ?? []).map((p) => {
      const info = authById.get(p.id);
      const dbStatus = (p.status ?? "ativo") as AdminUser["status"];
      const status: AdminUser["status"] =
        dbStatus === "desativado"
          ? "desativado"
          : info && !info.confirmed && !info.last_sign_in_at
            ? "convidado"
            : "ativo";
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        job_title: p.job_title ?? null,
        phone: p.phone ?? null,
        status,
        invited_at: p.invited_at ?? null,
        last_sign_in_at: info?.last_sign_in_at ?? p.last_sign_in_at ?? null,
        created_at: p.created_at,
        roles: parseRoles((roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role)),
      };
    });
  });

export const inviteAccessUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; fullName: string; roles: string[]; origin: string }) => ({
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    roles: parseRoles(input.roles),
    origin: input.origin,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.email) throw new Error("Informe o e-mail.");
    if (!data.fullName) throw new Error("Informe o nome completo.");
    if (!data.email.endsWith("@origoenergia.com.br")) {
      throw new Error("Somente e-mails @origoenergia.com.br podem ter acesso ao sistema.");
    }
    const db = await admin();

    // libera o e-mail antes de criar a conta (o banco só aceita e-mails liberados)
    await db.from("access_allowlist").upsert(
      {
        email: data.email,
        full_name: data.fullName,
        roles: (data.roles.length ? data.roles : ["colaborador"]) as never,
        created_by: context.userId,
      },
      { onConflict: "email" },
    );

    const { data: invited, error } = await db.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${data.origin}/definir-senha`,
      data: { full_name: data.fullName },
    });
    if (error) {
      throw new Error(
        error.message.includes("already been registered")
          ? "Este e-mail já possui acesso ao sistema."
          : error.message,
      );
    }
    const userId = invited.user!.id;

    await db
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: data.email,
          full_name: data.fullName,
          status: "convidado",
          invited_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    await db.from("user_roles").delete().eq("user_id", userId);
    if (data.roles.length) {
      await db.from("user_roles").insert(data.roles.map((role) => ({ user_id: userId, role })));
    }

    await writeAudit(context.userId, context.claims?.email ?? null, "convidar_acesso", userId, {
      email: data.email,
      roles: data.roles,
    });
    return { id: userId };
  });

export const resendAccessInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; email: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { error } = await db.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${data.origin}/definir-senha`,
    });
    if (error) throw new Error(error.message);
    await db
      .from("profiles")
      .update({ status: "convidado", invited_at: new Date().toISOString() })
      .eq("id", data.userId);
    await writeAudit(
      context.userId,
      context.claims?.email ?? null,
      "reenviar_convite",
      data.userId,
      { email: data.email },
    );
    return { ok: true };
  });

export const setAccessRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; roles: string[] }) => ({
    userId: input.userId,
    roles: parseRoles(input.roles),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId && !data.roles.includes("admin")) {
      throw new Error("Você não pode remover o seu próprio papel de administrador.");
    }
    const db = await admin();
    await db.from("user_roles").delete().eq("user_id", data.userId);
    if (data.roles.length) {
      await db.from("user_roles").insert(data.roles.map((role) => ({ user_id: data.userId, role })));
    }
    await writeAudit(
      context.userId,
      context.claims?.email ?? null,
      "atualizar_papeis",
      data.userId,
      { roles: data.roles },
    );
    return { ok: true };
  });

export const setAccessActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId && !data.active) {
      throw new Error("Você não pode desativar a sua própria conta.");
    }
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    await db
      .from("profiles")
      .update({ status: data.active ? "ativo" : "desativado" })
      .eq("id", data.userId);
    await writeAudit(
      context.userId,
      context.claims?.email ?? null,
      data.active ? "reativar_acesso" : "desativar_acesso",
      data.userId,
      {},
    );
    return { ok: true };
  });

export const revokeAccessUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a sua própria conta.");
    }
    const db = await admin();
    const { data: gone } = await db
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    await db.from("user_roles").delete().eq("user_id", data.userId);
    await db.from("profiles").delete().eq("id", data.userId);
    if (gone?.email) {
      await db.from("access_allowlist").delete().eq("email", gone.email.toLowerCase());
    }
    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, context.claims?.email ?? null, "excluir_acesso", data.userId, {});
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Lista de e-mails liberados (allowlist) — somente estes conseguem entrar
// ---------------------------------------------------------------------------

export const ALLOWED_EMAIL_DOMAIN = "origoenergia.com.br";

export type AllowedEmail = {
  id: string;
  email: string;
  full_name: string | null;
  roles: AdminRole[];
  note: string | null;
  created_at: string;
  has_account: boolean;
};

export const listAllowedEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AllowedEmail[]> => {
    await assertAdmin(context as never);
    const db = await admin();
    const [{ data: rows }, { data: profiles }] = await Promise.all([
      db.from("access_allowlist").select("*").order("email"),
      db.from("profiles").select("email"),
    ]);
    const accounts = new Set(
      (profiles ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean),
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      full_name: r.full_name ?? null,
      roles: parseRoles(r.roles ?? []),
      note: r.note ?? null,
      created_at: r.created_at,
      has_account: accounts.has(r.email.toLowerCase()),
    }));
  });

function assertOrigoEmail(email: string) {
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    throw new Error(`Somente e-mails @${ALLOWED_EMAIL_DOMAIN} podem ser liberados.`);
  }
}

export const addAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; fullName?: string; roles?: string[]; note?: string }) => ({
    email: input.email.trim().toLowerCase(),
    fullName: (input.fullName ?? "").trim(),
    roles: parseRoles(input.roles ?? []),
    note: (input.note ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.email) throw new Error("Informe o e-mail.");
    assertOrigoEmail(data.email);
    const db = await admin();
    const roles = data.roles.length ? data.roles : (["colaborador"] as AdminRole[]);
    const { error } = await db.from("access_allowlist").upsert(
      {
        email: data.email,
        full_name: data.fullName || null,
        roles: roles as never,
        note: data.note || null,
        created_by: context.userId,
      },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);

    // Se a pessoa já tentou entrar antes da liberação, a conta existe sem papéis:
    // concede os papéis agora e reativa o perfil.
    const { data: existing } = await db
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing?.id) {
      await db.from("profiles").update({ status: "ativo" }).eq("id", existing.id);
      await db
        .from("user_roles")
        .insert(roles.map((role) => ({ user_id: existing.id, role: role as never })));
    }
    await db
      .from("access_denied_attempts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("email", data.email);

    await writeAudit(context.userId, context.claims?.email ?? null, "liberar_email", null, {
      email: data.email,
      roles,
    });
    return { ok: true };
  });

export type DeniedAttempt = {
  id: string;
  email: string;
  full_name: string | null;
  attempts: number;
  last_attempt_at: string;
};

export const listDeniedAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeniedAttempt[]> => {
    await assertAdmin(context as never);
    const db = await admin();
    const { data } = await db
      .from("access_denied_attempts")
      .select("id, email, full_name, attempts, last_attempt_at")
      .is("resolved_at", null)
      .order("last_attempt_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      full_name: r.full_name ?? null,
      attempts: r.attempts,
      last_attempt_at: r.last_attempt_at,
    }));
  });

export const dismissDeniedAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { error } = await db
      .from("access_denied_attempts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => ({ email: input.email.trim().toLowerCase() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.email === (context.claims?.email ?? "").toLowerCase()) {
      throw new Error("Você não pode remover a liberação do seu próprio e-mail.");
    }
    const db = await admin();
    const { error } = await db.from("access_allowlist").delete().eq("email", data.email);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, context.claims?.email ?? null, "bloquear_email", null, {
      email: data.email,
    });
    return { ok: true };
  });
