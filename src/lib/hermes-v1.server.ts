import { dispatchAgreement } from "./dispatch-agreement.server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import {
  apiError,
  checkToken,
  hermesClient,
  json,
  pageMeta,
  pageParams,
  type Db,
} from "./hermes-api.server";
import { renderAgreement } from "./agreements";

export const BASE_URL = "https://gestaoativos.origoenergia.com.br/api/public/hermes/v1";
const RATE_LIMIT_PER_MIN = 300;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ------------------------------------------------------------------ tipos
type Scope = "read" | "write" | "destructive" | "admin";
const ALL_SCOPES: Scope[] = ["read", "write", "destructive", "admin"];

export function tokenScopes(): Scope[] {
  const raw = process.env["HERMES_API_SCOPES"] ?? "read,write,destructive";
  const set = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Scope => ALL_SCOPES.includes(s as Scope));
  return set.length ? set : ["read"];
}

type Ctx = {
  db: Db;
  userId: string;
  email: string;
  request: Request;
  url: URL;
  method: string;
  path: string;
  corr: string;
  batch: string;
  idem: string | null;
  hash: string;
  body: any;
  test: boolean;
  scopes: Scope[];
};

class ApiErr extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const fail = (status: number, code: string, message: string, details?: unknown) =>
  new ApiErr(status, code, message, details);

// ------------------------------------------------------------------ utilidades
export function etagOf(row: unknown) {
  return `W/"${createHash("sha256")
    .update(JSON.stringify(row ?? null))
    .digest("hex")
    .slice(0, 32)}"`;
}

function ok(
  ctx: Ctx,
  data: unknown,
  status = 200,
  extra: { meta?: Record<string, unknown>; etag?: string } = {},
) {
  const headers: Record<string, string> = { "X-Correlation-ID": ctx.corr };
  if (extra.etag) headers["ETag"] = extra.etag;
  return json(
    {
      data,
      meta: {
        correlation_id: ctx.corr,
        timestamp: new Date().toISOString(),
        ...(extra.etag ? { etag: extra.etag } : {}),
        ...extra.meta,
      },
    },
    status,
    headers,
  );
}

function dbErr(error: any): never {
  const code = error?.code as string | undefined;
  if (code === "23505")
    throw fail(409, "conflict_duplicate", "Registro duplicado (valor único já existe).", {
      db: error.message,
    });
  if (code === "23503")
    throw fail(409, "conflict_reference", "Registro relacionado impede a operação.", {
      db: error.message,
    });
  if (code === "42501" || /row-level security/i.test(error?.message ?? ""))
    throw fail(
      403,
      "forbidden_by_policy",
      "A conta de serviço não tem permissão para esta operação.",
    );
  throw fail(400, "db_error", error?.message ?? "Falha no banco.");
}

async function run(q: PromiseLike<{ data: any; error: any }>): Promise<any> {
  const { data, error } = await q;
  if (error) dbErr(error);
  return data;
}

async function getRow(ctx: Ctx, table: string, id: string, cols = "*") {
  const row = await run(ctx.db.from(table).select(cols).eq("id", id).maybeSingle());
  if (!row) throw fail(404, "not_found", `Registro não encontrado em ${table}.`, { id });
  return row as any;
}

function requireMatch(ctx: Ctx, row: any) {
  const h = ctx.request.headers.get("if-match")?.trim();
  const current = etagOf(row);
  if (!h)
    throw fail(
      428,
      "precondition_required",
      "Header If-Match obrigatório (ETag ou updated_at atual).",
      { current_etag: current, updated_at: row?.updated_at },
    );
  if (h !== current && !(row?.updated_at && h === row.updated_at))
    throw fail(
      412,
      "precondition_failed",
      "O registro foi alterado por outra pessoa. Consulte novamente e reenvie.",
      { current_etag: current, updated_at: row?.updated_at },
    );
}

function requireConfirm(ctx: Ctx, expected: string) {
  if (ctx.request.headers.get("x-confirm-delete") !== expected)
    throw fail(
      412,
      "confirmation_required",
      `Envie o header X-Confirm-Delete com o valor "${expected}".`,
    );
}

function parse<T extends z.ZodTypeAny>(ctx: Ctx, schema: T): z.infer<T> {
  const r = schema.safeParse(ctx.body ?? {});
  if (!r.success) throw fail(400, "validation_error", "Corpo inválido.", r.error.flatten());
  return r.data;
}

const strip = (row: any) => {
  if (!row) return row;
  const { id: _i, created_at: _c, updated_at: _u, ...rest } = row;
  return rest;
};

async function record(
  ctx: Ctx,
  operation: string,
  entity: string,
  id: string | null,
  before: any,
  after: any,
) {
  await ctx.db.from("hermes_operations").insert({
    idempotency_key: `${ctx.idem ?? "noidem"}#${operation}#${id ?? "-"}#${randomUUID()}`,
    correlation_id: ctx.corr,
    batch_id: ctx.batch,
    operation,
    request_hash: ctx.hash,
    entity,
    entity_id: id,
    before_state: before ?? null,
    after_state: after ?? null,
    created_by: ctx.userId,
  });
  await ctx.db.from("audit_log").insert({
    action: `hermes_${operation}`,
    entity,
    entity_id: id,
    actor_id: ctx.userId,
    actor_email: ctx.email,
    details: {
      origem: "hermes-api",
      metodo: ctx.method,
      caminho: ctx.path,
      correlation_id: ctx.corr,
      batch_id: ctx.batch,
      teste: ctx.test || !!after?.is_test || !!before?.is_test,
      antes: before ?? null,
      depois: after ?? null,
    },
  });
}

function qsafe(v: string) {
  return v
    .replace(/[,()%*\\]/g, " ")
    .trim()
    .slice(0, 100);
}

async function paged(
  ctx: Ctx,
  table: string,
  cols: string,
  order: string,
  eqParams: string[],
  extra?: (q: any) => any,
) {
  const { page, size, from, to } = pageParams(ctx.url);
  let q: any = ctx.db.from(table).select(cols, { count: "exact" }).order(order).range(from, to);
  for (const p of eqParams) {
    const v = ctx.url.searchParams.get(p);
    if (v) q = q.eq(p, v);
  }
  const t = ctx.url.searchParams.get("is_test");
  if (t === "true" || t === "false") q = q.eq("is_test", t === "true");
  if (extra) q = extra(q);
  const { data, count, error } = await q;
  if (error) dbErr(error);
  return ok(ctx, data, 200, { meta: { pagination: pageMeta(page, size, count) } });
}

const uuid = z.string().uuid();
const optStr = (max = 500) => z.string().trim().max(max).nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")
  .nullable()
  .optional();
const assetTypes = ["notebook", "celular", "monitor", "acessorio", "outro"] as const;

// ------------------------------------------------------------------ ativos
const assetCreate = z
  .object({
    asset_type: z.enum(assetTypes),
    serial_number: z.string().trim().min(1).max(120),
    brand: optStr(120),
    model: optStr(200),
    patrimony: optStr(120),
    imei: optStr(60),
    supplier: optStr(200),
    contract_number: optStr(120),
    lease_start: dateStr,
    lease_end: dateStr,
    monthly_cost: z.number().nonnegative().nullable().optional(),
    condition: optStr(200),
    location: optStr(200),
    status: z.enum(["disponivel", "manutencao", "devolvido", "extraviado"]).optional(),
    intune_device_id: optStr(200),
    intune_last_sync: z.string().datetime({ offset: true }).nullable().optional(),
    last_seen_location: optStr(300),
    bitdefender_installed: z.boolean().optional(),
    notes: optStr(2000),
    tag_ids: z.array(uuid).max(50).optional(),
    is_test: z.boolean().optional(),
  })
  .strict();
const assetPatch = assetCreate.omit({ is_test: true }).partial().strict();

async function setTags(ctx: Ctx, assetId: string, ids: string[]) {
  await run(ctx.db.from("asset_tags").delete().eq("asset_id", assetId));
  if (ids.length)
    await run(
      ctx.db.from("asset_tags").insert(ids.map((tag_id) => ({ asset_id: assetId, tag_id }))),
    );
}

async function assetFull(ctx: Ctx, id: string) {
  const asset = await getRow(ctx, "assets", id);
  const [tags, active] = await Promise.all([
    run(ctx.db.from("asset_tags").select("tag:tags(id,name,color)").eq("asset_id", id)),
    run(
      ctx.db
        .from("assignments")
        .select("id, employee_id, assigned_at, employee:employees(full_name,email)")
        .eq("asset_id", id)
        .eq("status", "ativo"),
    ),
  ]);
  return {
    asset,
    extra: { tags: (tags ?? []).map((t: any) => t.tag), active_assignment: active?.[0] ?? null },
  };
}

async function hasActive(ctx: Ctx, col: "asset_id" | "employee_id", id: string) {
  const rows = await run(
    ctx.db.from("assignments").select("id").eq(col, id).eq("status", "ativo").limit(1),
  );
  return (rows ?? []).length > 0;
}

const assets = {
  list: (ctx: Ctx) =>
    paged(
      ctx,
      "assets",
      "*",
      "serial_number",
      [
        "status",
        "serial_number",
        "asset_type",
        "location",
        "contract_number",
        "supplier",
        "patrimony",
      ],
      (q) => {
        const s = ctx.url.searchParams.get("q");
        return s
          ? q.or(
              `serial_number.ilike.%${qsafe(s)}%,patrimony.ilike.%${qsafe(s)}%,model.ilike.%${qsafe(s)}%`,
            )
          : q;
      },
    ),
  get: async (ctx: Ctx, p: any) => {
    const { asset, extra } = await assetFull(ctx, p.id);
    return ok(ctx, { ...asset, ...extra }, 200, { etag: etagOf(asset) });
  },
  create: async (ctx: Ctx) => {
    const { tag_ids, ...d } = parse(ctx, assetCreate);
    const row = await run(
      ctx.db
        .from("assets")
        .insert({ ...d, status: d.status ?? "disponivel", is_test: d.is_test ?? ctx.test })
        .select()
        .single(),
    );
    if (tag_ids?.length) await setTags(ctx, row.id, tag_ids);
    await record(ctx, "create", "assets", row.id, null, row);
    return ok(ctx, row, 201, { etag: etagOf(row) });
  },
  update: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "assets", p.id);
    requireMatch(ctx, before);
    const { tag_ids, ...d } = parse(ctx, assetPatch);
    if (d.status && (await hasActive(ctx, "asset_id", p.id)))
      throw fail(
        409,
        "asset_in_use",
        "Equipamento com vínculo ativo: registre a devolução (POST /assignments/{id}/return) antes de mudar a situação.",
      );
    const after = Object.keys(d).length
      ? await run(ctx.db.from("assets").update(d).eq("id", p.id).select().single())
      : before;
    if (tag_ids) await setTags(ctx, p.id, tag_ids);
    await record(ctx, "update", "assets", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  remove: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "assets", p.id);
    requireMatch(ctx, before);
    requireConfirm(ctx, p.id);
    if (await hasActive(ctx, "asset_id", p.id))
      throw fail(
        409,
        "asset_in_use",
        "Equipamento tem vínculo ativo. Registre a devolução antes de excluir.",
      );
    await run(
      ctx.db.rpc("archive_entities", { p_entity: "assets", p_ids: [p.id], p_restore: false }),
    );
    return ok(ctx, { id: p.id, archived: true, deleted: false });
  },
  assignments: async (ctx: Ctx, p: any) => {
    const data = await run(
      ctx.db.from("assignments").select("*").eq("asset_id", p.id).eq("status", "ativo"),
    );
    return ok(ctx, data);
  },
};

// ------------------------------------------------------------------ colaboradores
const employeeCreate = z
  .object({
    full_name: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(255),
    cpf: optStr(20),
    job_title: optStr(200),
    department: optStr(200),
    unit: optStr(200),
    manager_name: optStr(200),
    phone: optStr(40),
    status: z.enum(["ativo", "inativo", "afastado"]).optional(),
    entra_user_id: optStr(200),
    notes: optStr(2000),
    is_test: z.boolean().optional(),
  })
  .strict();
const employeePatch = employeeCreate.omit({ is_test: true }).partial().strict();

const employees = {
  list: (ctx: Ctx) =>
    paged(
      ctx,
      "employees",
      "*",
      "full_name",
      ["status", "department", "unit", "entra_user_id"],
      (q) => {
        let r = q;
        const email = ctx.url.searchParams.get("email");
        if (email) r = r.ilike("email", qsafe(email));
        const s = ctx.url.searchParams.get("q");
        if (s) r = r.or(`full_name.ilike.%${qsafe(s)}%,email.ilike.%${qsafe(s)}%`);
        return r;
      },
    ),
  get: async (ctx: Ctx, p: any) => {
    const e = await getRow(ctx, "employees", p.id);
    const active = await run(
      ctx.db
        .from("assignments")
        .select("id, asset_id, assigned_at, asset:assets(serial_number,model)")
        .eq("employee_id", p.id)
        .eq("status", "ativo"),
    );
    return ok(ctx, { ...e, active_assignments: active }, 200, { etag: etagOf(e) });
  },
  create: async (ctx: Ctx) => {
    const d = parse(ctx, employeeCreate);
    const row = await run(
      ctx.db
        .from("employees")
        .insert({ ...d, is_test: d.is_test ?? ctx.test })
        .select()
        .single(),
    );
    await record(ctx, "create", "employees", row.id, null, row);
    return ok(ctx, row, 201, { etag: etagOf(row) });
  },
  update: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "employees", p.id);
    requireMatch(ctx, before);
    const d = parse(ctx, employeePatch);
    const after = await run(ctx.db.from("employees").update(d).eq("id", p.id).select().single());
    await record(ctx, "update", "employees", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  remove: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "employees", p.id);
    requireMatch(ctx, before);
    requireConfirm(ctx, p.id);
    if (await hasActive(ctx, "employee_id", p.id))
      throw fail(
        409,
        "employee_has_assets",
        "Pessoa com equipamento em uso. Registre a devolução antes de excluir.",
      );
    await run(
      ctx.db.rpc("archive_entities", { p_entity: "employees", p_ids: [p.id], p_restore: false }),
    );
    return ok(ctx, { id: p.id, archived: true, deleted: false });
  },
};

// ------------------------------------------------------------------ vínculos
async function draftAgreement(
  ctx: Ctx,
  assignment: any,
  employee: any,
  asset: any,
  isTest: boolean,
  templateId?: string,
) {
  const tq = ctx.db.from("agreement_templates").select("id, body");
  const template = await run(
    templateId ? tq.eq("id", templateId).maybeSingle() : tq.eq("is_default", true).maybeSingle(),
  );
  if (!template) return null;
  const content = renderAgreement(template.body, employee, asset, {
    deliveryDate: assignment.assigned_at,
    deliveryCondition: assignment.delivery_condition ?? undefined,
  });
  const ag = await run(
    ctx.db
      .from("agreements")
      .insert({
        assignment_id: assignment.id,
        employee_id: employee.id,
        asset_id: asset.id,
        template_id: template.id,
        content,
        status: "rascunho",
        is_test: isTest,
      })
      .select()
      .single(),
  );
  await record(ctx, "create", "agreements", ag.id, null, ag);
  return ag;
}

const assignmentCreate = z
  .object({
    asset_id: uuid,
    employee_id: uuid,
    assigned_at: z.string().datetime().optional(),
    delivery_condition: optStr(500),
    notes: optStr(1000),
    create_agreement: z.boolean().default(false),
    assignment_kind: z.enum(["physical_delivery", "administrative"]).default("physical_delivery"),
    explicit_request: z.literal(true).optional(),
  })
  .strict();

async function openAssignment(ctx: Ctx, asset: any, employee: any, d: any) {
  if (asset.is_test !== employee.is_test)
    throw fail(422, "test_isolation", "Registros de teste precisam corresponder.");
  const template = d.create_agreement ? await run(
    ctx.db.from("agreement_templates").select("id,body").eq("is_default", true).single(),
  ) : null;
  const id = randomUUID(),
    assigned = d.assigned_at ?? new Date().toISOString();
  await run(
    ctx.db.rpc("create_assignment_complete", {
      p_id: id,
      p_asset_id: asset.id,
      p_employee_id: employee.id,
      p_assigned_at: assigned,
      p_delivery_condition: d.delivery_condition ?? "",
      p_notes: d.notes ?? "",
      p_template_id: template?.id ?? null,
      p_create_agreement: d.create_agreement,
      p_assignment_kind: d.assignment_kind,
      p_content: template ? renderAgreement(template.body, employee, asset, {
        deliveryDate: assigned,
        deliveryCondition: d.delivery_condition ?? "",
      }) : null,
      p_items: [
        {
          label: "Conferência pela integração",
          ok: null,
          reason: "Entrega registrada via Hermes; inspeção física não informada",
        },
      ],
      p_photos: [],
    }),
  );
  return {
    assignment: await getRow(ctx, "assignments", id),
    agreement: await run(ctx.db.from("agreements").select("*").eq("assignment_id", id).maybeSingle()),
  };
}

const assignments = {
  list: (ctx: Ctx) =>
    paged(ctx, "assignments", "*", "assigned_at", ["status", "asset_id", "employee_id"]),
  get: async (ctx: Ctx, p: any) => {
    const a = await getRow(ctx, "assignments", p.id);
    return ok(ctx, a, 200, { etag: etagOf(a) });
  },
  create: async (ctx: Ctx) => {
    const d = parse(ctx, assignmentCreate);
    const [asset, employee] = await Promise.all([
      getRow(ctx, "assets", d.asset_id),
      getRow(ctx, "employees", d.employee_id),
    ]);
    const active = await run(
      ctx.db
        .from("assignments")
        .select("id, employee_id")
        .eq("asset_id", d.asset_id)
        .eq("status", "ativo"),
    );
    if (active?.length)
      throw fail(409, "asset_already_assigned", "O equipamento já possui vínculo ativo.", {
        active_assignments: active,
      });
    const res = await openAssignment(ctx, asset, employee, d);
    return ok(ctx, res, 201, { etag: etagOf(res.assignment) });
  },
  update: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "assignments", p.id);
    requireMatch(ctx, before);
    const d = parse(
      ctx,
      z
        .object({
          notes: optStr(1000),
          delivery_condition: optStr(500),
          assigned_at: z.string().datetime().optional(),
        })
        .strict(),
    );
    const after = await run(ctx.db.from("assignments").update(d).eq("id", p.id).select().single());
    await record(ctx, "update", "assignments", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  giveBack: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "assignments", p.id);
    requireMatch(ctx, before);
    if (before.status !== "ativo") throw fail(409, "assignment_closed", "Vínculo já encerrado.");
    const d = parse(
      ctx,
      z
        .object({
          return_condition: optStr(500),
          returned_at: z.string().datetime().optional(),
          asset_status: z
            .enum(["disponivel", "manutencao", "devolvido", "extraviado"])
            .default("disponivel"),
        })
        .strict(),
    );
    await run(
      ctx.db.rpc("qa_transaction", {
        p_action: "return",
        p_data: {
          id: p.id,
          condition: d.return_condition ?? "",
          asset_status: d.asset_status,
          returned_at: d.returned_at,
          items: [
            {
              label: "Conferência pela integração",
              ok: null,
              reason: "Devolução registrada via Hermes; inspeção física não informada",
            },
          ],
          photos: [],
        },
      }),
    );
    const after = await getRow(ctx, "assignments", p.id);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  transfer: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "assignments", p.id);
    requireMatch(ctx, before);
    if (before.status !== "ativo")
      throw fail(409, "assignment_closed", "Só é possível transferir um vínculo ativo.");
    const d = parse(
      ctx,
      z
        .object({
          to_employee_id: uuid,
          delivery_condition: optStr(500),
          notes: optStr(1000),
          create_agreement: z.boolean().default(false),
    assignment_kind: z.enum(["physical_delivery", "administrative"]).default("physical_delivery"),
        })
        .strict(),
    );
    if (d.to_employee_id === before.employee_id)
      throw fail(422, "same_employee", "O destino é o mesmo colaborador atual.");
    const [to, asset] = await Promise.all([
      getRow(ctx, "employees", d.to_employee_id),
      getRow(ctx, "assets", before.asset_id),
    ]);
    const template = d.create_agreement ? await run(
      ctx.db.from("agreement_templates").select("id,body").eq("is_default", true).single(),
    ) : null;
    const id = randomUUID(),
      assigned = new Date().toISOString();
    await run(
      ctx.db.rpc("qa_transaction", {
        p_action: "transfer",
        p_data: {
          id: p.id,
          new_id: id,
          employee_id: to.id,
          assigned_at: assigned,
          condition: d.delivery_condition ?? "",
          notes: d.notes ?? "",
          template_id: template?.id ?? null,
          create_agreement: d.create_agreement,
          assignment_kind: d.assignment_kind,
          content: template ? renderAgreement(template.body, to, asset, {
            deliveryDate: assigned,
            deliveryCondition: d.delivery_condition ?? "",
          }) : null,
          items: [
            { label: "Conferência pela integração", ok: null, reason: "Transferência via Hermes" },
          ],
        },
      }),
    );
    const created = await getRow(ctx, "assignments", id);
    return ok(
      ctx,
      {
        closed_assignment: await getRow(ctx, "assignments", p.id),
        assignment: created,
        agreement: await run(
          ctx.db.from("agreements").select("*").eq("assignment_id", id).maybeSingle(),
        ),
      },
      201,
      { etag: etagOf(created) },
    );
  },
};

// ------------------------------------------------------------------ inventário
const inventory = {
  list: (ctx: Ctx) => paged(ctx, "inventory_sessions", "*", "created_at", ["status"]),
  create: async (ctx: Ctx) => {
    const d = parse(
      ctx,
      z
        .object({
          name: z.string().trim().min(1).max(200),
          scope: z
            .object({
              location: z.string().max(200).optional(),
              asset_type: z.enum(assetTypes).optional(),
            })
            .strict()
            .default({}),
          is_test: z.boolean().optional(),
        })
        .strict(),
    );
    const row = await run(
      ctx.db
        .from("inventory_sessions")
        .insert({
          name: d.name,
          scope: d.scope,
          created_by: ctx.userId,
          is_test: d.is_test ?? ctx.test,
        })
        .select()
        .single(),
    );
    await record(ctx, "create", "inventory_sessions", row.id, null, row);
    return ok(ctx, row, 201, { etag: etagOf(row) });
  },
  get: async (ctx: Ctx, p: any) => {
    const s = await getRow(ctx, "inventory_sessions", p.id);
    const checks = await run(
      ctx.db
        .from("inventory_checks")
        .select(
          "id, asset_id, checked_at, checked_by, divergencia, asset:assets(serial_number, model, location)",
        )
        .eq("session_id", p.id)
        .order("checked_at"),
    );
    let q: any = ctx.db
      .from("assets")
      .select("id", { count: "exact", head: true })
      .neq("status", "extraviado");
    if (s.scope?.location) q = q.eq("location", s.scope.location);
    if (s.scope?.asset_type) q = q.eq("asset_type", s.scope.asset_type);
    const { count } = await q;
    const inScope = (checks ?? []).filter((c: any) => !c.divergencia).length;
    return ok(
      ctx,
      {
        ...s,
        checks,
        summary: {
          expected: count ?? 0,
          checked: checks?.length ?? 0,
          checked_in_scope: inScope,
          missing: Math.max(0, (count ?? 0) - inScope),
          divergences: (checks?.length ?? 0) - inScope,
        },
      },
      200,
      { etag: etagOf(s) },
    );
  },
  check: async (ctx: Ctx, p: any) => {
    const s = await getRow(ctx, "inventory_sessions", p.id);
    if (s.status !== "aberta") throw fail(409, "session_closed", "Conferência encerrada.");
    const d = parse(
      ctx,
      z
        .object({
          asset_id: uuid.optional(),
          serial_number: z.string().trim().min(1).max(120).optional(),
        })
        .strict()
        .refine((v) => v.asset_id || v.serial_number, "Informe asset_id ou serial_number."),
    );
    const asset = d.asset_id
      ? await getRow(ctx, "assets", d.asset_id)
      : await run(
          ctx.db.from("assets").select("*").eq("serial_number", d.serial_number!).maybeSingle(),
        );
    if (!asset) throw fail(404, "asset_not_found", "Equipamento não encontrado.");
    const out =
      (s.scope?.location && asset.location !== s.scope.location) ||
      (s.scope?.asset_type && asset.asset_type !== s.scope.asset_type);
    const { data: row, error } = await ctx.db
      .from("inventory_checks")
      .insert({
        session_id: p.id,
        asset_id: asset.id,
        checked_by: ctx.userId,
        divergencia: out ? "Fora do escopo" : null,
      })
      .select()
      .single();
    if (error?.code === "23505")
      throw fail(409, "already_checked", `Série ${asset.serial_number} já conferida.`);
    if (error) dbErr(error);
    await record(ctx, "inventory_check", "inventory_checks", row.id, null, row);
    return ok(ctx, row, 201);
  },
  close: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "inventory_sessions", p.id);
    requireMatch(ctx, before);
    if (before.status !== "aberta") throw fail(409, "session_closed", "Conferência já encerrada.");
    const after = await run(
      ctx.db
        .from("inventory_sessions")
        .update({ status: "encerrada", closed_at: new Date().toISOString() })
        .eq("id", p.id)
        .select()
        .single(),
    );
    await record(ctx, "close_inventory", "inventory_sessions", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
};

// ------------------------------------------------------------------ termos
const agreementListCols =
  "id, assignment_id, asset_id, employee_id, template_id, status, provider, external_envelope_id, sent_at, viewed_at, signed_at, declined_reason, signed_document_path, is_test, created_at, updated_at";

async function sendAgreement(ctx: Ctx, agreement: any) {
  return dispatchAgreement(ctx.db, agreement.id, ctx.userId);
}

const agreements = {
  list: (ctx: Ctx) =>
    paged(ctx, "agreements", agreementListCols, "created_at", [
      "status",
      "asset_id",
      "employee_id",
      "assignment_id",
    ]),
  get: async (ctx: Ctx, p: any) => {
    const a = await getRow(ctx, "agreements", p.id);
    return ok(ctx, a, 200, { etag: etagOf(a) });
  },
  create: async (ctx: Ctx) => {
    const d = parse(
      ctx,
      z
        .object({
          assignment_id: uuid,
          template_id: uuid.optional(),
          content: z.string().min(10).max(50000).optional(),
        })
        .strict(),
    );
    const asg = await getRow(ctx, "assignments", d.assignment_id);
    const [asset, employee] = await Promise.all([
      getRow(ctx, "assets", asg.asset_id),
      getRow(ctx, "employees", asg.employee_id),
    ]);
    let ag: any;
    if (d.content) {
      ag = await run(
        ctx.db
          .from("agreements")
          .insert({
            assignment_id: asg.id,
            asset_id: asset.id,
            employee_id: employee.id,
            template_id: d.template_id ?? null,
            content: d.content,
            status: "rascunho",
            is_test: asg.is_test,
          })
          .select()
          .single(),
      );
      await record(ctx, "create", "agreements", ag.id, null, ag);
    } else {
      ag = await draftAgreement(ctx, asg, employee, asset, asg.is_test, d.template_id);
      if (!ag)
        throw fail(
          422,
          "template_not_found",
          "Nenhum modelo de termo encontrado (padrão ou informado).",
        );
    }
    return ok(ctx, ag, 201, { etag: etagOf(ag) });
  },
  update: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "agreements", p.id);
    requireMatch(ctx, before);
    const d = parse(
      ctx,
      z
        .object({
          content: z.string().min(10).max(50000).optional(),
          declined_reason: optStr(1000),
        })
        .strict(),
    );
    if (d.content && before.status !== "rascunho")
      throw fail(409, "agreement_locked", "O conteúdo só pode ser alterado em rascunho.");
    const after = await run(ctx.db.from("agreements").update(d).eq("id", p.id).select().single());
    await record(ctx, "update", "agreements", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  send: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "agreements", p.id);
    requireMatch(ctx, before);
    if (!["rascunho", "recusado", "expirado"].includes(before.status))
      throw fail(
        409,
        "invalid_status",
        `Termo com situação "${before.status}" não pode ser enviado.`,
      );
    const result = await sendAgreement(ctx, before);
    const after = await getRow(ctx, "agreements", p.id);
    await record(ctx, "send_agreement", "agreements", p.id, before, {
      ...after,
      send_result: result,
    });
    return ok(ctx, { ...result, agreement: after }, 200, { etag: etagOf(after) });
  },
  cancel: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "agreements", p.id);
    requireMatch(ctx, before);
    const d = parse(ctx, z.object({ reason: z.string().trim().min(3).max(500) }).strict());
    if (before.status === "assinado")
      throw fail(409, "agreement_signed", "Termo já assinado não pode ser cancelado.");
    if (before.status === "expirado")
      throw fail(409, "already_cancelled", "Termo já cancelado/expirado.");
    const after = await run(
      ctx.db
        .from("agreements")
        .update({ status: "expirado", declined_reason: `Cancelado: ${d.reason}` })
        .eq("id", p.id)
        .select()
        .single(),
    );
    await record(ctx, "cancel_agreement", "agreements", p.id, before, after);
    return ok(ctx, after, 200, { etag: etagOf(after) });
  },
  remind: async (ctx: Ctx, p: any) => {
    const a = await getRow(ctx, "agreements", p.id);
    if (!["enviado", "visualizado"].includes(a.status))
      throw fail(409, "invalid_status", "Só é possível cobrar termos enviados e não assinados.");
    const d = parse(ctx, z.object({ note: optStr(500) }).strict());
    const row = await run(
      ctx.db
        .from("agreement_reminders")
        .insert({ agreement_id: p.id, sent_by: ctx.userId, note: d.note ?? "Cobrança via Hermes" })
        .select()
        .single(),
    );
    await record(ctx, "remind_agreement", "agreement_reminders", row.id, null, row);
    return ok(ctx, row, 201);
  },
  templates: async (ctx: Ctx) =>
    ok(
      ctx,
      await run(
        ctx.db
          .from("agreement_templates")
          .select("id, name, body, is_default, updated_at")
          .order("name"),
      ),
    ),
};

// ------------------------------------------------------------------ documentos
const documents = {
  list: (ctx: Ctx) =>
    paged(ctx, "documents", "*", "created_at", ["asset_id", "employee_id", "agreement_id", "kind"]),
  create: async (ctx: Ctx) => {
    const d = parse(
      ctx,
      z
        .object({
          file_name: z.string().trim().min(1).max(200),
          content_base64: z.string().min(4),
          content_type: z.string().max(100).default("application/pdf"),
          kind: z.string().trim().min(1).max(50).default("outro"),
          asset_id: uuid.optional(),
          employee_id: uuid.optional(),
          agreement_id: uuid.optional(),
          is_test: z.boolean().optional(),
        })
        .strict()
        .refine(
          (v) => v.asset_id || v.employee_id || v.agreement_id,
          "Informe asset_id, employee_id ou agreement_id.",
        ),
    );
    const bytes = Buffer.from(d.content_base64, "base64");
    if (!bytes.length) throw fail(400, "invalid_base64", "Arquivo vazio ou base64 inválido.");
    if (bytes.length > MAX_UPLOAD_BYTES)
      throw fail(413, "file_too_large", "Arquivo acima de 10 MB.");
    let agreement: any = null;
    if (d.agreement_id) agreement = await getRow(ctx, "agreements", d.agreement_id);
    const asset_id = d.asset_id ?? agreement?.asset_id ?? null;
    const employee_id = d.employee_id ?? agreement?.employee_id ?? null;
    const safe = d.file_name.replace(/[^\w.-]+/g, "-");
    const hash = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const path = `${agreement ? `termos/${agreement.id}` : `hermes/${asset_id ?? employee_id}`}/${hash}-${safe}`;
    const up = await ctx.db.storage
      .from("asset-documents")
      .upload(path, bytes, { contentType: d.content_type, upsert: false });
    if (
      up.error &&
      String((up.error as any).statusCode) !== "409" &&
      !/already exists/i.test(up.error.message)
    )
      throw fail(400, "upload_failed", up.error.message);
    let row: any;
    if (agreement && d.kind === "termo_assinado") {
      await run(
        ctx.db.rpc("qa_transaction", {
          p_action: "attach_signed",
          p_data: { id: agreement.id, name: d.file_name, path },
        }),
      );
      row = await run(
        ctx.db
          .from("documents")
          .select("*")
          .eq("agreement_id", agreement.id)
          .eq("storage_path", path)
          .single(),
      );
    } else {
      row = await run(
        ctx.db
          .from("documents")
          .insert({
            agreement_id: agreement?.id ?? null,
            asset_id,
            employee_id,
            kind: d.kind,
            file_name: d.file_name,
            storage_path: path,
            uploaded_by: ctx.userId,
            is_test: d.is_test ?? ctx.test,
          })
          .select()
          .single(),
      );
      await record(ctx, "create", "documents", row.id, null, row);
    }
    return ok(ctx, row, 201, { etag: etagOf(row) });
  },
  download: async (ctx: Ctx, p: any) => {
    const doc = await getRow(ctx, "documents", p.id);
    const { data, error } = await ctx.db.storage
      .from("asset-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data)
      throw fail(404, "file_not_found", "Arquivo não encontrado no armazenamento.");
    return ok(ctx, { id: doc.id, file_name: doc.file_name, url: data.signedUrl, expires_in: 300 });
  },
  remove: async (ctx: Ctx, p: any) => {
    const before = await getRow(ctx, "documents", p.id);
    requireMatch(ctx, before);
    requireConfirm(ctx, p.id);
    await ctx.db.storage.from("asset-documents").remove([before.storage_path]);
    await run(ctx.db.from("documents").delete().eq("id", p.id));
    await record(ctx, "delete", "documents", p.id, before, null);
    return ok(ctx, { id: p.id, deleted: true });
  },
};

// ------------------------------------------------------------------ cadastros auxiliares
function lookup(table: "tags" | "locations" | "vendors" | "departments") {
  const isTag = table === "tags";
  const create = z
    .object({
      name: z.string().trim().min(1).max(120),
      ...(isTag
        ? { color: z.string().trim().min(1).max(30).optional() }
        : { active: z.boolean().optional() }),
      is_test: z.boolean().optional(),
    })
    .strict();
  const patch = create.omit({ is_test: true }).partial().strict();
  return {
    create,
    patch,
    list: (ctx: Ctx) =>
      paged(ctx, table, "*", "name", isTag ? [] : ["active"], (q) => {
        const s = ctx.url.searchParams.get("q");
        return s ? q.ilike("name", `%${qsafe(s)}%`) : q;
      }),
    get: async (ctx: Ctx, p: any) => {
      const r = await getRow(ctx, table, p.id);
      return ok(ctx, r, 200, { etag: etagOf(r) });
    },
    post: async (ctx: Ctx) => {
      const d: any = parse(ctx, create);
      const row = await run(
        ctx.db
          .from(table)
          .insert({ ...d, is_test: d.is_test ?? ctx.test })
          .select()
          .single(),
      );
      await record(ctx, "create", table, row.id, null, row);
      return ok(ctx, row, 201, { etag: etagOf(row) });
    },
    update: async (ctx: Ctx, p: any) => {
      const before = await getRow(ctx, table, p.id);
      requireMatch(ctx, before);
      const d = parse(ctx, patch);
      const after = await run(ctx.db.from(table).update(d).eq("id", p.id).select().single());
      await record(ctx, "update", table, p.id, before, after);
      return ok(ctx, after, 200, { etag: etagOf(after) });
    },
    remove: async (ctx: Ctx, p: any) => {
      const before = await getRow(ctx, table, p.id);
      requireMatch(ctx, before);
      requireConfirm(ctx, p.id);
      if (isTag || before.is_test) {
        if (isTag) await run(ctx.db.from("asset_tags").delete().eq("tag_id", p.id));
        await run(ctx.db.from(table).delete().eq("id", p.id));
        await record(ctx, "delete", table, p.id, before, null);
        return ok(ctx, { id: p.id, deleted: true, soft: false });
      }
      const after = await run(
        ctx.db.from(table).update({ active: false }).eq("id", p.id).select().single(),
      );
      await record(ctx, "update", table, p.id, before, after);
      return ok(ctx, { ...after, deleted: true, soft: true }, 200, { etag: etagOf(after) });
    },
  };
}
const lookups = {
  tags: lookup("tags"),
  locations: lookup("locations"),
  vendors: lookup("vendors"),
  departments: lookup("departments"),
};

// ------------------------------------------------------------------ mapeamentos (v1 original)
const mappingItem = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("asset_intune"),
    asset_id: uuid,
    intune_device_id: z.string().min(1).max(200).nullable(),
  }),
  z.object({
    type: z.literal("employee_entra"),
    employee_id: uuid,
    entra_user_id: z.string().min(1).max(200).nullable(),
  }),
]);
const mappingsBody = z.object({ items: z.array(mappingItem).min(1).max(500) });

async function planMappings(db: Db, items: z.infer<typeof mappingItem>[]) {
  return Promise.all(
    items.map(async (it, index): Promise<any> => {
      if (it.type === "asset_intune") {
        const { data: asset } = await db
          .from("assets")
          .select("id, intune_device_id")
          .eq("id", it.asset_id)
          .maybeSingle();
        if (!asset) return { index, ...it, result: "error", error: "asset_not_found" };
        if (it.intune_device_id) {
          const { data: other } = await db
            .from("assets")
            .select("id")
            .eq("intune_device_id", it.intune_device_id)
            .neq("id", it.asset_id)
            .maybeSingle();
          if (other)
            return {
              index,
              ...it,
              result: "error",
              error: "intune_device_already_mapped",
              conflict_asset_id: other.id,
            };
        }
        return {
          index,
          ...it,
          result: asset.intune_device_id === it.intune_device_id ? "unchanged" : "update",
          before: { intune_device_id: asset.intune_device_id },
        };
      }
      const { data: emp } = await db
        .from("employees")
        .select("id, entra_user_id")
        .eq("id", it.employee_id)
        .maybeSingle();
      if (!emp) return { index, ...it, result: "error", error: "employee_not_found" };
      if (it.entra_user_id) {
        const { data: other } = await db
          .from("employees")
          .select("id")
          .eq("entra_user_id", it.entra_user_id)
          .neq("id", it.employee_id)
          .maybeSingle();
        if (other)
          return {
            index,
            ...it,
            result: "error",
            error: "entra_user_already_mapped",
            conflict_employee_id: other.id,
          };
      }
      return {
        index,
        ...it,
        result: emp.entra_user_id === it.entra_user_id ? "unchanged" : "update",
        before: { entra_user_id: emp.entra_user_id },
      };
    }),
  );
}
const summarize = (plan: { result: string }[]) =>
  plan.reduce<Record<string, number>>((a, p) => ((a[p.result] = (a[p.result] ?? 0) + 1), a), {});

const mappings = {
  preview: async (ctx: Ctx) => {
    const d = parse(ctx, mappingsBody);
    const plan = await planMappings(ctx.db, d.items);
    return ok(ctx, { dry_run: true, items: plan, summary: summarize(plan) });
  },
  apply: async (ctx: Ctx) => {
    const d = parse(ctx, mappingsBody);
    const plan = await planMappings(ctx.db, d.items);
    const results: any[] = [];
    for (const p of plan) {
      if (p.result !== "update") {
        results.push(p);
        continue;
      }
      const isAsset = p.type === "asset_intune";
      const table = isAsset ? "assets" : "employees";
      const id = isAsset ? p.asset_id : p.employee_id;
      const after = isAsset
        ? { intune_device_id: p.intune_device_id }
        : { entra_user_id: p.entra_user_id };
      const { error } = await ctx.db.from(table).update(after).eq("id", id);
      if (error) {
        results.push({ ...p, result: "error", error: "update_failed" });
        continue;
      }
      await record(ctx, p.type, table, id, p.before, after);
      results.push({ ...p, result: "updated" });
    }
    return ok(ctx, { batch_id: ctx.batch, items: results, summary: summarize(results) });
  },
};

// ------------------------------------------------------------------ operações e reversão
const operations = {
  list: async (ctx: Ctx) => {
    const corr = ctx.url.searchParams.get("correlation_id");
    const batch = ctx.url.searchParams.get("batch_id");
    if (!corr && !batch) throw fail(400, "filter_required", "Informe correlation_id ou batch_id.");
    return paged(
      ctx,
      "hermes_operations",
      "id, correlation_id, batch_id, operation, entity, entity_id, before_state, after_state, reverted_at, created_at",
      "created_at",
      ["correlation_id", "batch_id"],
      (q) => q.neq("entity", "batch"),
    );
  },
  revert: async (ctx: Ctx, p: any) => {
    const batchId = p.batch_id;
    if (ctx.request.headers.get("x-confirm-revert") !== batchId)
      throw fail(
        412,
        "confirmation_required",
        "Envie o header X-Confirm-Revert com o mesmo batch_id.",
      );
    const ops = await run(
      ctx.db
        .from("hermes_operations")
        .select("*")
        .eq("batch_id", batchId)
        .is("reverted_at", null)
        .neq("entity", "batch")
        .neq("operation", "revert")
        .order("created_at", { ascending: false }),
    );
    if (!ops?.length)
      throw fail(404, "nothing_to_revert", "Nenhuma alteração pendente de reversão neste lote.");
    const results: any[] = [];
    for (const op of ops) {
      let ok2 = false;
      let reason: string | undefined;
      const b = op.before_state,
        a = op.after_state;
      if (
        ["asset_intune", "employee_entra"].includes(op.operation) ||
        (op.operation === "update" && b)
      ) {
        ok2 = !(await ctx.db.from(op.entity).update(strip(b)).eq("id", op.entity_id)).error;
      } else if (op.operation === "create_assignment") {
        const r = await ctx.db.rpc("qa_transaction", {
          p_action: "return",
          p_data: {
            id: op.entity_id,
            condition: "Revertido pelo Hermes",
            items: [
              { label: "Reversão pela integração", ok: null, reason: "Reversão administrativa" },
            ],
            photos: [],
          },
        });
        ok2 = !r.error;
        reason = r.error?.message;
      } else if (op.operation === "return_assignment" && b) {
        const r = await ctx.db.rpc("qa_transaction", {
          p_action: "undo_return",
          p_data: { id: op.entity_id },
        });
        ok2 = !r.error;
        reason = r.error?.message;
      } else if (op.operation === "create" && a?.is_test) {
        ok2 = !(await ctx.db.from(op.entity).delete().eq("id", op.entity_id)).error;
        if (!ok2) reason = "delete_blocked_by_references";
      } else {
        reason = "not_revertible";
      }
      if (ok2)
        await ctx.db
          .from("hermes_operations")
          .update({ reverted_at: new Date().toISOString() })
          .eq("id", op.id);
      results.push({
        operation_id: op.id,
        operation: op.operation,
        entity: op.entity,
        entity_id: op.entity_id,
        reverted: ok2,
        reason,
      });
    }
    await ctx.db
      .from("audit_log")
      .insert({
        action: "hermes_reverter_lote",
        entity: "hermes_operations",
        actor_id: ctx.userId,
        actor_email: ctx.email,
        details: {
          origem: "hermes-api",
          batch_id: batchId,
          correlation_id: ctx.corr,
          itens: results.length,
        },
      });
    return ok(ctx, { batch_id: batchId, items: results });
  },
};

// ------------------------------------------------------------------ ambiente de teste
const TEST_TABLES = [
  "inventory_sessions",
  "documents",
  "agreements",
  "assignments",
  "assets",
  "employees",
  "tags",
  "locations",
  "vendors",
  "departments",
];
const testArea = {
  list: async (ctx: Ctx) => {
    const out: Record<string, any> = {};
    for (const t of TEST_TABLES)
      out[t] = (await run(ctx.db.from(t).select("id").eq("is_test", true).limit(500))).map(
        (r: any) => r.id,
      );
    return ok(ctx, out);
  },
  purge: async (ctx: Ctx) => {
    requireConfirm(ctx, "test-records");
    const removed: Record<string, number> = {};
    const sessions = (
      await run(ctx.db.from("inventory_sessions").select("id").eq("is_test", true))
    ).map((r: any) => r.id);
    if (sessions.length)
      await run(ctx.db.from("inventory_checks").delete().in("session_id", sessions));
    const docs = await run(ctx.db.from("documents").select("id, storage_path").eq("is_test", true));
    if (docs.length)
      await ctx.db.storage.from("asset-documents").remove(docs.map((d: any) => d.storage_path));
    const testAssets = (await run(ctx.db.from("assets").select("id").eq("is_test", true))).map(
      (r: any) => r.id,
    );
    if (testAssets.length) {
      await run(ctx.db.from("inventory_checks").delete().in("asset_id", testAssets));
      await run(ctx.db.from("asset_tags").delete().in("asset_id", testAssets));
    }
    const testTags = (await run(ctx.db.from("tags").select("id").eq("is_test", true))).map(
      (r: any) => r.id,
    );
    if (testTags.length) await run(ctx.db.from("asset_tags").delete().in("tag_id", testTags));
    const testAgreements = (
      await run(ctx.db.from("agreements").select("id").eq("is_test", true))
    ).map((r: any) => r.id);
    if (testAgreements.length)
      await run(ctx.db.from("agreement_reminders").delete().in("agreement_id", testAgreements));
    for (const t of TEST_TABLES) {
      const rows = await run(ctx.db.from(t).delete().eq("is_test", true).select("id"));
      removed[t] = rows?.length ?? 0;
    }
    await record(ctx, "purge_test_records", "test", null, null, removed);
    return ok(ctx, { removed });
  },
};

// ------------------------------------------------------------------ tabela de rotas
type Handler = (ctx: Ctx, p: Record<string, string>) => Promise<Response>;
type RouteDef = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  scope: Scope;
  tag: string;
  summary: string;
  handler: Handler;
  body?: z.ZodTypeAny;
  query?: string[];
  ifMatch?: boolean;
  confirm?: string;
  example?: unknown;
};

const pageQ = ["page", "page_size", "is_test"];
const L = lookups;
function lookupRoutes(name: keyof typeof lookups, tag: string): RouteDef[] {
  const h = L[name];
  const ex =
    name === "tags"
      ? { name: "TESTE Hermes", color: "turquesa", is_test: true }
      : { name: "TESTE Hermes", is_test: true };
  return [
    {
      method: "GET",
      path: `/${name}`,
      scope: "read",
      tag,
      summary: `Listar ${tag.toLowerCase()}`,
      handler: h.list,
      query: [...pageQ, "q", ...(name === "tags" ? [] : ["active"])],
    },
    {
      method: "GET",
      path: `/${name}/:id`,
      scope: "read",
      tag,
      summary: "Consultar por ID",
      handler: h.get,
    },
    {
      method: "POST",
      path: `/${name}`,
      scope: "write",
      tag,
      summary: "Criar",
      handler: h.post,
      body: h.create,
      example: ex,
    },
    {
      method: "PATCH",
      path: `/${name}/:id`,
      scope: "write",
      tag,
      summary: "Alterar",
      handler: h.update,
      body: h.patch,
      ifMatch: true,
      example: { name: "TESTE Hermes (editado)" },
    },
    {
      method: "DELETE",
      path: `/${name}/:id`,
      scope: "destructive",
      tag,
      summary:
        name === "tags"
          ? "Excluir etiqueta (remove dos equipamentos)"
          : "Desativar (soft delete; registros de teste são excluídos)",
      handler: h.remove,
      ifMatch: true,
      confirm: "{id}",
    },
  ];
}

export const ROUTES: RouteDef[] = [
  {
    method: "GET",
    path: "/openapi.json",
    scope: "read",
    tag: "Descoberta",
    summary: "Documento OpenAPI 3.1",
    handler: async () => json(openapi()),
  },
  {
    method: "GET",
    path: "/capabilities",
    scope: "read",
    tag: "Descoberta",
    summary: "Rotas, métodos e escopos efetivos do token",
    handler: async (ctx) => ok(ctx, capabilities(ctx.scopes)),
  },

  {
    method: "GET",
    path: "/assets",
    scope: "read",
    tag: "Ativos",
    summary: "Listar equipamentos",
    handler: assets.list,
    query: [
      ...pageQ,
      "q",
      "status",
      "serial_number",
      "asset_type",
      "location",
      "contract_number",
      "supplier",
      "patrimony",
    ],
  },
  {
    method: "GET",
    path: "/assets/:id",
    scope: "read",
    tag: "Ativos",
    summary: "Consultar equipamento (com etiquetas e vínculo ativo)",
    handler: assets.get,
  },
  {
    method: "POST",
    path: "/assets",
    scope: "write",
    tag: "Ativos",
    summary: "Cadastrar equipamento",
    handler: assets.create,
    body: assetCreate,
    example: {
      asset_type: "notebook",
      serial_number: "TESTE-HERMES-0001",
      brand: "HP",
      model: "ProBook 440",
      supplier: "Simpress",
      is_test: true,
    },
  },
  {
    method: "PATCH",
    path: "/assets/:id",
    scope: "write",
    tag: "Ativos",
    summary: "Alterar equipamento",
    handler: assets.update,
    body: assetPatch,
    ifMatch: true,
    example: { location: "Recife", notes: "Ajuste via Hermes" },
  },
  {
    method: "DELETE",
    path: "/assets/:id",
    scope: "destructive",
    tag: "Ativos",
    summary: "Excluir equipamento (bloqueado com vínculo ativo)",
    handler: assets.remove,
    ifMatch: true,
    confirm: "{id}",
  },
  {
    method: "GET",
    path: "/assets/:id/assignments",
    scope: "read",
    tag: "Ativos",
    summary: "Vínculos ativos do equipamento",
    handler: assets.assignments,
  },

  {
    method: "GET",
    path: "/employees",
    scope: "read",
    tag: "Colaboradores",
    summary: "Listar colaboradores",
    handler: employees.list,
    query: [...pageQ, "q", "email", "status", "department", "unit", "entra_user_id"],
  },
  {
    method: "GET",
    path: "/employees/:id",
    scope: "read",
    tag: "Colaboradores",
    summary: "Consultar colaborador (com equipamentos em uso)",
    handler: employees.get,
  },
  {
    method: "POST",
    path: "/employees",
    scope: "write",
    tag: "Colaboradores",
    summary: "Cadastrar colaborador",
    handler: employees.create,
    body: employeeCreate,
    example: {
      full_name: "Teste Hermes",
      email: "teste.hermes@origoenergia.com.br",
      department: "TI",
      is_test: true,
    },
  },
  {
    method: "PATCH",
    path: "/employees/:id",
    scope: "write",
    tag: "Colaboradores",
    summary: "Alterar colaborador",
    handler: employees.update,
    body: employeePatch,
    ifMatch: true,
    example: { job_title: "Analista" },
  },
  {
    method: "DELETE",
    path: "/employees/:id",
    scope: "destructive",
    tag: "Colaboradores",
    summary: "Excluir colaborador (bloqueado com equipamento em uso)",
    handler: employees.remove,
    ifMatch: true,
    confirm: "{id}",
  },

  {
    method: "GET",
    path: "/assignments",
    scope: "read",
    tag: "Vínculos",
    summary: "Listar vínculos",
    handler: assignments.list,
    query: [...pageQ, "status", "asset_id", "employee_id"],
  },
  {
    method: "GET",
    path: "/assignments/:id",
    scope: "read",
    tag: "Vínculos",
    summary: "Consultar vínculo",
    handler: assignments.get,
  },
  {
    method: "POST",
    path: "/assignments",
    scope: "write",
    tag: "Vínculos",
    summary: "Vincular equipamento (termo opcional; administrativo não comprova entrega)",
    handler: assignments.create,
    body: assignmentCreate,
    example: {
      asset_id: "<uuid>",
      employee_id: "<uuid>",
      delivery_condition: "Novo",
      create_agreement: false,
      assignment_kind: "administrative",
    },
  },
  {
    method: "PATCH",
    path: "/assignments/:id",
    scope: "write",
    tag: "Vínculos",
    summary: "Alterar observações/condição/data",
    handler: assignments.update,
    body: z.object({
      notes: optStr(1000),
      delivery_condition: optStr(500),
      assigned_at: z.string().datetime().optional(),
    }),
    ifMatch: true,
    example: { notes: "Entregue na portaria" },
  },
  {
    method: "POST",
    path: "/assignments/:id/return",
    scope: "write",
    tag: "Vínculos",
    summary: "Registrar devolução",
    handler: assignments.giveBack,
    body: z.object({
      return_condition: optStr(500),
      returned_at: z.string().datetime().optional(),
      asset_status: z.enum(["disponivel", "manutencao", "devolvido", "extraviado"]).optional(),
    }),
    ifMatch: true,
    example: { return_condition: "Bom estado", asset_status: "disponivel" },
  },
  {
    method: "POST",
    path: "/assignments/:id/transfer",
    scope: "write",
    tag: "Vínculos",
    summary: "Transferir para outro colaborador",
    handler: assignments.transfer,
    body: z.object({
      to_employee_id: uuid,
      delivery_condition: optStr(500),
      notes: optStr(1000),
      create_agreement: z.boolean().default(false),
      assignment_kind: z.enum(["physical_delivery", "administrative"]).default("physical_delivery"),
    }),
    ifMatch: true,
    example: { to_employee_id: "<uuid>" },
  },

  {
    method: "GET",
    path: "/inventory-sessions",
    scope: "read",
    tag: "Inventário",
    summary: "Listar conferências",
    handler: inventory.list,
    query: [...pageQ, "status"],
  },
  {
    method: "POST",
    path: "/inventory-sessions",
    scope: "write",
    tag: "Inventário",
    summary: "Abrir conferência",
    handler: inventory.create,
    body: z.object({
      name: z.string(),
      scope: z
        .object({ location: z.string().optional(), asset_type: z.enum(assetTypes).optional() })
        .optional(),
      is_test: z.boolean().optional(),
    }),
    example: { name: "Conferência teste Hermes", scope: { location: "Recife" }, is_test: true },
  },
  {
    method: "GET",
    path: "/inventory-sessions/:id",
    scope: "read",
    tag: "Inventário",
    summary: "Consultar conferência com itens e resumo",
    handler: inventory.get,
  },
  {
    method: "POST",
    path: "/inventory-sessions/:id/checks",
    scope: "write",
    tag: "Inventário",
    summary: "Conferir equipamento (por ID ou série)",
    handler: inventory.check,
    body: z.object({ asset_id: uuid.optional(), serial_number: z.string().optional() }),
    example: { serial_number: "TESTE-HERMES-0001" },
  },
  {
    method: "POST",
    path: "/inventory-sessions/:id/close",
    scope: "write",
    tag: "Inventário",
    summary: "Encerrar conferência",
    handler: inventory.close,
    ifMatch: true,
  },

  {
    method: "GET",
    path: "/agreements",
    scope: "read",
    tag: "Termos",
    summary: "Listar termos (sem conteúdo)",
    handler: agreements.list,
    query: [...pageQ, "status", "asset_id", "employee_id", "assignment_id"],
  },
  {
    method: "GET",
    path: "/agreements/:id",
    scope: "read",
    tag: "Termos",
    summary: "Consultar termo (com conteúdo)",
    handler: agreements.get,
  },
  {
    method: "POST",
    path: "/agreements",
    scope: "write",
    tag: "Termos",
    summary: "Gerar termo em rascunho para um vínculo",
    handler: agreements.create,
    body: z.object({
      assignment_id: uuid,
      template_id: uuid.optional(),
      content: z.string().optional(),
    }),
    example: { assignment_id: "<uuid>" },
  },
  {
    method: "PATCH",
    path: "/agreements/:id",
    scope: "write",
    tag: "Termos",
    summary: "Alterar conteúdo (só rascunho) ou motivo",
    handler: agreements.update,
    body: z.object({ content: z.string().optional(), declined_reason: optStr(1000) }),
    ifMatch: true,
    example: { content: "Texto revisado do termo..." },
  },
  {
    method: "POST",
    path: "/agreements/:id/send",
    scope: "write",
    tag: "Termos",
    summary: "Enviar para assinatura",
    handler: agreements.send,
    ifMatch: true,
  },
  {
    method: "POST",
    path: "/agreements/:id/cancel",
    scope: "write",
    tag: "Termos",
    summary: "Cancelar termo (situação passa a expirado)",
    handler: agreements.cancel,
    body: z.object({ reason: z.string() }),
    ifMatch: true,
    example: { reason: "Termo gerado por engano" },
  },
  {
    method: "POST",
    path: "/agreements/:id/remind",
    scope: "write",
    tag: "Termos",
    summary: "Registrar cobrança de termo pendente",
    handler: agreements.remind,
    body: z.object({ note: optStr(500) }),
    example: { note: "Lembrete enviado por e-mail" },
  },
  {
    method: "GET",
    path: "/agreement-templates",
    scope: "read",
    tag: "Termos",
    summary: "Listar modelos de termo",
    handler: agreements.templates,
  },

  {
    method: "GET",
    path: "/documents",
    scope: "read",
    tag: "Documentos",
    summary: "Listar documentos",
    handler: documents.list,
    query: [...pageQ, "asset_id", "employee_id", "agreement_id", "kind"],
  },
  {
    method: "POST",
    path: "/documents",
    scope: "write",
    tag: "Documentos",
    summary:
      "Anexar documento (base64, até 10 MB). kind=termo_assinado + agreement_id marca o termo como assinado",
    handler: documents.create,
    body: z.object({
      file_name: z.string(),
      content_base64: z.string(),
      content_type: z.string().optional(),
      kind: z.string().optional(),
      asset_id: uuid.optional(),
      employee_id: uuid.optional(),
      agreement_id: uuid.optional(),
      is_test: z.boolean().optional(),
    }),
    example: {
      file_name: "teste.pdf",
      content_base64: "JVBERi0xLjQK",
      kind: "outro",
      asset_id: "<uuid>",
      is_test: true,
    },
  },
  {
    method: "GET",
    path: "/documents/:id/download",
    scope: "read",
    tag: "Documentos",
    summary: "Link temporário de download (5 min)",
    handler: documents.download,
  },
  {
    method: "DELETE",
    path: "/documents/:id",
    scope: "destructive",
    tag: "Documentos",
    summary: "Excluir documento e arquivo",
    handler: documents.remove,
    ifMatch: true,
    confirm: "{id}",
  },

  ...lookupRoutes("tags", "Etiquetas"),
  ...lookupRoutes("locations", "Localidades"),
  ...lookupRoutes("vendors", "Fornecedores"),
  ...lookupRoutes("departments", "Departamentos"),

  {
    method: "GET",
    path: "/audit-log",
    scope: "read",
    tag: "Auditoria",
    summary: "Consultar auditoria",
    handler: (ctx) =>
      paged(ctx, "audit_log", "*", "created_at", ["entity", "entity_id", "action", "actor_email"]),
    query: ["page", "page_size", "entity", "entity_id", "action", "actor_email"],
  },

  {
    method: "POST",
    path: "/mappings/preview",
    scope: "read",
    tag: "Mapeamentos",
    summary: "Prévia de mapeamento Intune/Entra (sem gravar)",
    handler: mappings.preview,
    body: mappingsBody,
    example: { items: [{ type: "asset_intune", asset_id: "<uuid>", intune_device_id: "abc" }] },
  },
  {
    method: "POST",
    path: "/mappings",
    scope: "write",
    tag: "Mapeamentos",
    summary: "Aplicar mapeamento Intune/Entra",
    handler: mappings.apply,
    body: mappingsBody,
    example: {
      items: [
        {
          type: "employee_entra",
          employee_id: "<uuid>",
          entra_user_id: "00000000-0000-0000-0000-000000000000",
        },
      ],
    },
  },
  {
    method: "GET",
    path: "/operations",
    scope: "read",
    tag: "Operações",
    summary: "Histórico de operações por correlation_id ou batch_id",
    handler: operations.list,
    query: ["page", "page_size", "correlation_id", "batch_id"],
  },
  {
    method: "POST",
    path: "/batches/:batch_id/revert",
    scope: "destructive",
    tag: "Operações",
    summary: "Reverter alterações de um lote (header X-Confirm-Revert)",
    handler: operations.revert,
  },

  {
    method: "GET",
    path: "/test/records",
    scope: "read",
    tag: "Teste",
    summary: "Listar registros marcados como teste",
    handler: testArea.list,
  },
  {
    method: "DELETE",
    path: "/test/records",
    scope: "destructive",
    tag: "Teste",
    summary: "Excluir todos os registros de teste",
    handler: testArea.purge,
    confirm: "test-records",
  },
];

// ------------------------------------------------------------------ descoberta
export const NOT_IN_API = [
  {
    feature: "Gestão de acessos, papéis e liberação de e-mails (Administração)",
    reason: "Bloqueado de propósito: exige escopo admin, que o token não possui.",
  },
  {
    feature:
      "Configurações e preferências do sistema (prazos, modelo padrão de termo, integrações)",
    reason: "Administrativo; só pela tela.",
  },
  {
    feature: "Importação em massa por planilha",
    reason: "Use POST /assets e POST /employees em lote.",
  },
  {
    feature: "Checklist de entrega/devolução com fotos",
    reason: "Ainda sem endpoint; fotos podem ir por POST /documents.",
  },
  {
    feature: "Exportações XLSX/CSV e folha de etiquetas QR",
    reason: "Funções de tela; os dados estão nas listagens.",
  },
  { feature: "Painel/indicadores e filtros salvos", reason: "Visualização; derive das listagens." },
  {
    feature: "Criar/editar modelos de termo",
    reason: "Somente leitura via GET /agreement-templates.",
  },
];

function capabilities(scopes: Scope[]) {
  return {
    base_url: BASE_URL,
    version: "1.1.0",
    token: {
      scopes,
      admin: scopes.includes("admin"),
      note: "Nenhuma rota altera papéis ou permissões administrativas.",
    },
    rate_limit: { requests_per_minute: RATE_LIMIT_PER_MIN },
    conventions: {
      auth: "Authorization: Bearer <token> e User-Agent identificável",
      post_requires: ["Idempotency-Key"],
      writes_require_if_match:
        "PATCH, DELETE e ações sobre um registro exigem If-Match com o ETag (ou updated_at) atual",
      delete_requires: "X-Confirm-Delete com o ID do registro",
      content_type: "application/json",
      test_mode:
        "Envie is_test: true no corpo ou o header X-Hermes-Test: true para criar registros de teste; limpe com DELETE /test/records",
    },
    routes: ROUTES.map((r) => ({
      method: r.method,
      path: r.path.replace(/:(\w+)/g, "{$1}"),
      scope: r.scope,
      allowed: scopes.includes(r.scope),
      summary: r.summary,
      requires_if_match: !!r.ifMatch,
      requires_idempotency_key: r.method === "POST",
      requires_confirm: r.confirm ?? null,
    })),
    not_available_in_api: NOT_IN_API,
  };
}

function zodToSchema(s: any): any {
  const d = s?._def;
  switch (d?.typeName) {
    case "ZodObject": {
      const shape = d.shape();
      const properties: any = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries<any>(shape)) {
        properties[k] = zodToSchema(v);
        if (!v.isOptional()) required.push(k);
      }
      return {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      };
    }
    case "ZodString": {
      const o: any = { type: "string" };
      for (const c of d.checks ?? []) {
        if (c.kind === "uuid") o.format = "uuid";
        if (c.kind === "email") o.format = "email";
        if (c.kind === "datetime") o.format = "date-time";
        if (c.kind === "max") o.maxLength = c.value;
        if (c.kind === "min") o.minLength = c.value;
        if (c.kind === "regex") o.pattern = c.regex.source;
      }
      return o;
    }
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: d.values };
    case "ZodLiteral":
      return { enum: [d.value] };
    case "ZodArray":
      return { type: "array", items: zodToSchema(d.type) };
    case "ZodOptional":
      return zodToSchema(d.innerType);
    case "ZodNullable": {
      const i = zodToSchema(d.innerType);
      return { ...i, type: [i.type ?? "string", "null"] };
    }
    case "ZodDefault":
      return { ...zodToSchema(d.innerType), default: d.defaultValue() };
    case "ZodEffects":
      return zodToSchema(d.schema);
    case "ZodDiscriminatedUnion":
      return { oneOf: [...d.options.values()].map(zodToSchema) };
    default:
      return {};
  }
}

export function openapi() {
  const paths: any = {};
  for (const r of ROUTES) {
    const p = r.path.replace(/:(\w+)/g, "{$1}");
    const params: any[] = [...r.path.matchAll(/:(\w+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string", format: m[1] === "id" ? "uuid" : undefined },
    }));
    for (const q of r.query ?? [])
      params.push({
        name: q,
        in: "query",
        required: false,
        schema: { type: q === "page" || q === "page_size" ? "integer" : "string" },
      });
    params.push({ $ref: "#/components/parameters/CorrelationId" });
    if (r.method === "POST") params.push({ $ref: "#/components/parameters/IdempotencyKey" });
    if (r.ifMatch) params.push({ $ref: "#/components/parameters/IfMatch" });
    if (r.confirm)
      params.push({
        name: "X-Confirm-Delete",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: `Valor: ${r.confirm}`,
      });
    if (r.path.includes("/revert"))
      params.push({
        name: "X-Confirm-Revert",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Mesmo batch_id da URL",
      });
    paths[p] ??= {};
    paths[p][r.method.toLowerCase()] = {
      tags: [r.tag],
      summary: r.summary,
      operationId: `${r.method.toLowerCase()}_${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}`,
      "x-scope": r.scope,
      parameters: params,
      ...(r.body
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: zodToSchema(r.body),
                  ...(r.example ? { example: r.example } : {}),
                },
              },
            },
          }
        : {}),
      responses: {
        [r.method === "POST" &&
        !r.path.includes("/close") &&
        !r.path.includes("/send") &&
        !r.path.includes("/cancel") &&
        !r.path.includes("preview") &&
        !r.path.includes("revert") &&
        !r.path.endsWith("/return")
          ? "201"
          : "200"]: { $ref: "#/components/responses/Success" },
        "400": { $ref: "#/components/responses/Error" },
        "401": { $ref: "#/components/responses/Error" },
        "403": { $ref: "#/components/responses/Error" },
        "404": { $ref: "#/components/responses/Error" },
        "409": { $ref: "#/components/responses/Error" },
        "412": { $ref: "#/components/responses/Error" },
        "428": { $ref: "#/components/responses/Error" },
        "429": { $ref: "#/components/responses/Error" },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Órigo Asset Management — API Hermes",
      version: "1.1.0",
      description:
        "API do agente Hermes. Todas as operações passam pelas mesmas regras e permissões da conta de serviço dedicada.",
    },
    servers: [{ url: BASE_URL }],
    security: [{ bearer: [] }],
    tags: [...new Set(ROUTES.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      parameters: {
        CorrelationId: {
          name: "X-Correlation-ID",
          in: "header",
          required: false,
          schema: { type: "string", maxLength: 200 },
        },
        IdempotencyKey: {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string", minLength: 8, maxLength: 200 },
        },
        IfMatch: {
          name: "If-Match",
          in: "header",
          required: true,
          schema: { type: "string" },
          description: "ETag retornado na leitura (ou o updated_at).",
        },
      },
      schemas: {
        Meta: {
          type: "object",
          properties: {
            correlation_id: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            etag: { type: "string" },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                page_size: { type: "integer" },
                total: { type: "integer" },
                total_pages: { type: "integer" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
              required: ["code", "message"],
            },
          },
        },
      },
      responses: {
        Success: {
          description: "Sucesso",
          headers: { ETag: { schema: { type: "string" } } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: {}, meta: { $ref: "#/components/schemas/Meta" } },
              },
            },
          },
        },
        Error: {
          description: "Erro",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  };
}

// ------------------------------------------------------------------ despacho
function match(method: string, parts: string[]) {
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const segs = r.path.split("/").filter(Boolean);
    if (segs.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let okm = true;
    segs.forEach((s, i) => {
      if (s.startsWith(":")) params[s.slice(1)] = decodeURIComponent(parts[i]!);
      else if (s !== parts[i]) okm = false;
    });
    if (okm) return { route: r, params };
  }
  return null;
}

async function replay(db: Db, idem: string, hash: string) {
  const { data } = await db
    .from("hermes_operations")
    .select("request_hash, response, status_code")
    .eq("idempotency_key", idem)
    .maybeSingle();
  if (!data) return null;
  if (data.request_hash !== hash)
    return apiError(422, "idempotency_conflict", "Idempotency-Key já usada com outro conteúdo.");
  return json(data.response, data.status_code, { "Idempotent-Replay": "true" });
}

export async function dispatch(request: Request, splat: string) {
  if (!checkToken(request)) return apiError(401, "unauthorized", "Token ausente ou inválido.");
  const ua = request.headers.get("user-agent")?.trim() ?? "";
  if (ua.length < 3)
    return apiError(400, "user_agent_required", "Envie um User-Agent identificável.");

  const url = new URL(request.url);
  const parts = splat.split("/").filter(Boolean);
  const method = request.method.toUpperCase();
  const m = match(method, parts);
  if (!m) {
    const anyMethod = ROUTES.filter((r) => match(r.method, parts)).map((r) => r.method);
    return anyMethod.length
      ? json(
          {
            error: {
              code: "method_not_allowed",
              message: "Método não permitido.",
              details: { allowed: anyMethod },
            },
          },
          405,
          { Allow: anyMethod.join(", ") },
        )
      : apiError(404, "route_not_found", "Rota não encontrada. Veja GET /capabilities.");
  }
  const { route, params } = m;
  const scopes = tokenScopes();
  if (!scopes.includes(route.scope))
    return apiError(403, "insufficient_scope", `Este token não possui o escopo "${route.scope}".`, {
      required: route.scope,
      granted: scopes,
    });
  for (const [k, v] of Object.entries(params))
    if (k === "id" && !uuid.safeParse(v).success)
      return apiError(400, "invalid_id", "ID inválido.");

  let session;
  try {
    session = await hermesClient();
  } catch {
    return apiError(503, "service_account_unavailable", "Conta de serviço indisponível.");
  }
  const db = session.client;

  // rate limit
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("hermes_request_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_MIN)
    return json(
      {
        error: {
          code: "rate_limited",
          message: "Limite de requisições por minuto atingido.",
          details: { limit: RATE_LIMIT_PER_MIN },
        },
      },
      429,
      { "Retry-After": "60" },
    );

  const corr = request.headers.get("x-correlation-id")?.trim().slice(0, 200) || randomUUID();
  const batch = request.headers.get("x-batch-id")?.trim().slice(0, 200) || corr;
  let body: any = undefined;
  if (method === "POST" || method === "PATCH") {
    const raw = await request.text();
    if (raw.trim()) {
      const ct = request.headers.get("content-type") ?? "";
      if (!ct.toLowerCase().startsWith("application/json"))
        return apiError(415, "unsupported_media_type", "Use Content-Type: application/json.");
      try {
        body = JSON.parse(raw);
      } catch {
        return apiError(400, "invalid_json", "JSON inválido.");
      }
    } else if (route.body && method === "PATCH") {
      return apiError(400, "empty_body", "Corpo obrigatório.");
    }
  }
  const idem = request.headers.get("idempotency-key")?.trim() ?? null;
  if (method === "POST" && (!idem || idem.length < 8 || idem.length > 200))
    return apiError(
      400,
      "idempotency_key_required",
      "Header Idempotency-Key obrigatório (8–200 caracteres).",
    );
  const hash = createHash("sha256")
    .update(JSON.stringify({ method, splat, body: body ?? null }))
    .digest("hex");

  const ctx: Ctx = {
    db,
    userId: session.userId,
    email: session.email,
    request,
    url,
    method,
    path: `/${parts.join("/")}`,
    corr,
    batch,
    idem,
    hash,
    body,
    scopes,
    test: request.headers.get("x-hermes-test") === "true",
  };

  let response: Response;
  if (method === "POST" && idem) {
    const prior = await replay(db, idem, hash);
    if (prior) response = prior;
  }
  // @ts-expect-error atribuída condicionalmente acima
  if (!response) {
    try {
      response = await route.handler(ctx, params);
    } catch (e) {
      if (e instanceof ApiErr) response = apiError(e.status, e.code, e.message, e.details);
      else {
        console.error("hermes-api", e);
        response = apiError(500, "internal_error", "Erro interno.");
      }
    }
    if (method === "POST" && idem && response.status < 500) {
      const text = await response.clone().text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      await db.from("hermes_operations").insert({
        idempotency_key: idem,
        correlation_id: corr,
        batch_id: batch,
        operation: `${method} ${route.path}`,
        request_hash: hash,
        entity: "batch",
        response: parsed,
        status_code: response.status,
        created_by: session.userId,
      });
    }
  }
  await db
    .from("hermes_request_log")
    .insert({
      method,
      path: ctx.path,
      status_code: response.status,
      correlation_id: corr,
      user_agent: ua.slice(0, 200),
    });
  const h = new Headers(response.headers);
  h.set("X-Correlation-ID", corr);
  h.set("X-RateLimit-Limit", String(RATE_LIMIT_PER_MIN));
  h.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_PER_MIN - (count ?? 0) - 1)));
  return new Response(response.body, { status: response.status, headers: h });
}
