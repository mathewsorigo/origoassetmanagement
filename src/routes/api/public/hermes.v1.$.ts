import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  apiError,
  checkToken,
  hashBody,
  hermesClient,
  json,
  pageMeta,
  pageParams,
  type Db,
} from "@/lib/hermes-api.server";

const uuid = z.string().uuid();
const mappingItem = z.discriminatedUnion("type", [
  z.object({ type: z.literal("asset_intune"), asset_id: uuid, intune_device_id: z.string().min(1).max(200).nullable() }),
  z.object({ type: z.literal("employee_entra"), employee_id: uuid, entra_user_id: z.string().min(1).max(200).nullable() }),
]);
const mappingsBody = z.object({ items: z.array(mappingItem).min(1).max(500) });
const assignmentBody = z.object({
  asset_id: uuid,
  employee_id: uuid,
  explicit_request: z.literal(true),
  assigned_at: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

type Ctx = { db: Db; userId: string; email: string; request: Request; url: URL };
type WriteHeaders = { idem: string; corr: string; batch: string };

function writeHeaders(request: Request): WriteHeaders | Response {
  const idem = request.headers.get("idempotency-key")?.trim() ?? "";
  const corr = request.headers.get("x-correlation-id")?.trim() ?? "";
  const batch = request.headers.get("x-batch-id")?.trim() || corr;
  if (idem.length < 8 || idem.length > 200) return apiError(400, "idempotency_key_required", "Header Idempotency-Key obrigatório (8–200 caracteres).");
  if (!corr || corr.length > 200) return apiError(400, "correlation_id_required", "Header X-Correlation-ID obrigatório.");
  return { idem, corr, batch };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function replay(db: Db, idem: string, hash: string) {
  const { data } = await db.from("hermes_operations").select("request_hash, response, status_code").eq("idempotency_key", idem).maybeSingle();
  if (!data) return null;
  if (data.request_hash !== hash) return apiError(422, "idempotency_conflict", "Idempotency-Key já usada com outro conteúdo.");
  return json(data.response, data.status_code, { "Idempotent-Replay": "true" });
}

async function audit(ctx: Ctx, action: string, entity: string, entityId: string | null, details: object) {
  await ctx.db.from("audit_log").insert({
    action, entity, entity_id: entityId, actor_id: ctx.userId, actor_email: ctx.email,
    details: { origem: "hermes-api", ...details },
  });
}

// ---------- validação de mapeamentos (sem gravar) ----------
type PlanItem = { index: number; result: string; [k: string]: any };
async function planMappings(db: Db, items: z.infer<typeof mappingItem>[]): Promise<PlanItem[]> {
  return Promise.all(
    items.map(async (it, index) => {
      if (it.type === "asset_intune") {
        const { data: asset } = await db.from("assets").select("id, serial_number, intune_device_id").eq("id", it.asset_id).maybeSingle();
        if (!asset) return { index, ...it, result: "error", error: "asset_not_found" };
        if (it.intune_device_id) {
          const { data: other } = await db.from("assets").select("id").eq("intune_device_id", it.intune_device_id).neq("id", it.asset_id).maybeSingle();
          if (other) return { index, ...it, result: "error", error: "intune_device_already_mapped", conflict_asset_id: other.id };
        }
        const unchanged = asset.intune_device_id === it.intune_device_id;
        return { index, ...it, result: unchanged ? "unchanged" : "update", before: { intune_device_id: asset.intune_device_id } };
      }
      const { data: emp } = await db.from("employees").select("id, email, entra_user_id").eq("id", it.employee_id).maybeSingle();
      if (!emp) return { index, ...it, result: "error", error: "employee_not_found" };
      if (it.entra_user_id) {
        const { data: other } = await db.from("employees").select("id").eq("entra_user_id", it.entra_user_id).neq("id", it.employee_id).maybeSingle();
        if (other) return { index, ...it, result: "error", error: "entra_user_already_mapped", conflict_employee_id: other.id };
      }
      const unchanged = emp.entra_user_id === it.entra_user_id;
      return { index, ...it, result: unchanged ? "unchanged" : "update", before: { entra_user_id: emp.entra_user_id } };
    }),
  );
}

// ---------- handlers ----------
async function listAssets(ctx: Ctx) {
  const { page, size, from, to } = pageParams(ctx.url);
  let q = ctx.db.from("assets").select("id, serial_number, patrimony, intune_device_id, status", { count: "exact" }).order("serial_number").range(from, to);
  const status = ctx.url.searchParams.get("status");
  const serial = ctx.url.searchParams.get("serial_number");
  if (status) q = q.eq("status", status);
  if (serial) q = q.eq("serial_number", serial);
  const { data, count, error } = await q;
  if (error) return apiError(400, "query_failed", error.message);
  return json({ data, pagination: pageMeta(page, size, count) });
}

async function listEmployees(ctx: Ctx) {
  const { page, size, from, to } = pageParams(ctx.url);
  let q = ctx.db.from("employees").select("id, full_name, email, status, entra_user_id", { count: "exact" }).order("full_name").range(from, to);
  const status = ctx.url.searchParams.get("status");
  const email = ctx.url.searchParams.get("email");
  if (status) q = q.eq("status", status);
  if (email) q = q.ilike("email", email);
  const { data, count, error } = await q;
  if (error) return apiError(400, "query_failed", error.message);
  return json({ data: data?.map((e) => ({ ...e, name: e.full_name })), pagination: pageMeta(page, size, count) });
}

const assignmentCols = "id, asset_id, employee_id, status, assigned_at, returned_at, notes, created_at";

async function assetAssignments(ctx: Ctx, assetId: string) {
  if (!uuid.safeParse(assetId).success) return apiError(400, "invalid_id", "ID inválido.");
  const { data, error } = await ctx.db.from("assignments").select(assignmentCols).eq("asset_id", assetId).eq("status", "ativo");
  if (error) return apiError(400, "query_failed", error.message);
  return json({ data });
}

async function getAssignment(ctx: Ctx, id: string) {
  if (!uuid.safeParse(id).success) return apiError(400, "invalid_id", "ID inválido.");
  const { data } = await ctx.db.from("assignments").select(assignmentCols).eq("id", id).maybeSingle();
  if (!data) return apiError(404, "not_found", "Vínculo não encontrado.");
  return json({ data });
}

async function previewMappings(ctx: Ctx) {
  const parsed = mappingsBody.safeParse(await readJson(ctx.request));
  if (!parsed.success) return apiError(400, "validation_error", "Corpo inválido.", parsed.error.flatten());
  const plan = await planMappings(ctx.db, parsed.data.items);
  return json({ dry_run: true, items: plan, summary: summarize(plan) });
}

function summarize(plan: { result: string }[]) {
  return plan.reduce<Record<string, number>>((acc, p) => ((acc[p.result] = (acc[p.result] ?? 0) + 1), acc), {});
}

async function applyMappings(ctx: Ctx) {
  const h = writeHeaders(ctx.request);
  if (h instanceof Response) return h;
  const body = await readJson(ctx.request);
  const parsed = mappingsBody.safeParse(body);
  if (!parsed.success) return apiError(400, "validation_error", "Corpo inválido.", parsed.error.flatten());
  const hash = hashBody(body);
  const prior = await replay(ctx.db, h.idem, hash);
  if (prior) return prior;

  const plan = await planMappings(ctx.db, parsed.data.items);
  const results: any[] = [];
  for (const p of plan) {
    if (p.result !== "update") { results.push(p); continue; }
    const isAsset = p.type === "asset_intune";
    const table = isAsset ? "assets" : "employees";
    const id = isAsset ? p.asset_id : p.employee_id;
    const after = isAsset ? { intune_device_id: p.intune_device_id } : { entra_user_id: p.entra_user_id };
    const { error } = await ctx.db.from(table).update(after).eq("id", id);
    if (error) { results.push({ ...p, result: "error", error: "update_failed" }); continue; }
    const { data: op } = await ctx.db.from("hermes_operations").insert({
      idempotency_key: `${h.idem}#${p.index}`, correlation_id: h.corr, batch_id: h.batch,
      operation: p.type, request_hash: hash, entity: table, entity_id: id,
      before_state: p.before, after_state: after, created_by: ctx.userId,
    }).select("id").single();
    await audit(ctx, `hermes_${p.type}`, table, id, { correlation_id: h.corr, batch_id: h.batch, antes: p.before, depois: after });
    results.push({ ...p, result: "updated", operation_id: op?.id });
  }
  const response = { batch_id: h.batch, correlation_id: h.corr, items: results, summary: summarize(results) };
  await ctx.db.from("hermes_operations").insert({
    idempotency_key: h.idem, correlation_id: h.corr, batch_id: h.batch, operation: "mappings",
    request_hash: hash, entity: "batch", response, status_code: 200, created_by: ctx.userId,
  });
  return json(response);
}

async function createAssignment(ctx: Ctx) {
  const h = writeHeaders(ctx.request);
  if (h instanceof Response) return h;
  const body = await readJson(ctx.request);
  const parsed = assignmentBody.safeParse(body);
  if (!parsed.success) return apiError(400, "validation_error", "Corpo inválido. explicit_request deve ser true.", parsed.error.flatten());
  const hash = hashBody(body);
  const prior = await replay(ctx.db, h.idem, hash);
  if (prior) return prior;
  const d = parsed.data;

  const [{ data: asset }, { data: emp }] = await Promise.all([
    ctx.db.from("assets").select("id, status").eq("id", d.asset_id).maybeSingle(),
    ctx.db.from("employees").select("id, status").eq("id", d.employee_id).maybeSingle(),
  ]);
  if (!asset) return apiError(404, "asset_not_found", "Equipamento não encontrado.");
  if (!emp) return apiError(404, "employee_not_found", "Colaborador não encontrado.");
  const { data: active } = await ctx.db.from("assignments").select("id, employee_id").eq("asset_id", d.asset_id).eq("status", "ativo");
  if (active && active.length > 0) return apiError(409, "asset_already_assigned", "O equipamento já possui vínculo ativo.", { active_assignments: active });

  const { data: created, error } = await ctx.db.from("assignments").insert({
    asset_id: d.asset_id, employee_id: d.employee_id, status: "ativo",
    assigned_at: d.assigned_at ?? new Date().toISOString(),
    notes: d.notes ?? `Criado pelo Hermes (correlation ${h.corr})`, created_by: ctx.userId,
  }).select(assignmentCols).single();
  if (error || !created) return apiError(400, "insert_failed", error?.message ?? "Falha ao criar vínculo.");
  await ctx.db.from("assets").update({ status: "em_uso" }).eq("id", d.asset_id);

  const response = { data: created, batch_id: h.batch, correlation_id: h.corr };
  await ctx.db.from("hermes_operations").insert({
    idempotency_key: h.idem, correlation_id: h.corr, batch_id: h.batch, operation: "create_assignment",
    request_hash: hash, entity: "assignments", entity_id: created.id,
    before_state: { asset_status: asset.status }, after_state: created, response, status_code: 201, created_by: ctx.userId,
  });
  await audit(ctx, "hermes_criar_vinculo", "assignments", created.id, { correlation_id: h.corr, batch_id: h.batch, asset_id: d.asset_id, employee_id: d.employee_id });
  return json(response, 201);
}

async function listOperations(ctx: Ctx) {
  const { page, size, from, to } = pageParams(ctx.url);
  const corr = ctx.url.searchParams.get("correlation_id");
  const batch = ctx.url.searchParams.get("batch_id");
  if (!corr && !batch) return apiError(400, "filter_required", "Informe correlation_id ou batch_id.");
  let q = ctx.db.from("hermes_operations")
    .select("id, idempotency_key, correlation_id, batch_id, operation, entity, entity_id, before_state, after_state, status_code, reverted_at, created_at", { count: "exact" })
    .neq("entity", "batch").order("created_at").range(from, to);
  if (corr) q = q.eq("correlation_id", corr);
  if (batch) q = q.eq("batch_id", batch);
  const { data, count, error } = await q;
  if (error) return apiError(400, "query_failed", error.message);
  return json({ data, pagination: pageMeta(page, size, count) });
}

async function revertBatch(ctx: Ctx, batchId: string) {
  const h = writeHeaders(ctx.request);
  if (h instanceof Response) return h;
  if (ctx.request.headers.get("x-confirm-revert") !== batchId)
    return apiError(412, "confirmation_required", "Envie o header X-Confirm-Revert com o mesmo batch_id.");
  const hash = hashBody({ revert: batchId });
  const prior = await replay(ctx.db, h.idem, hash);
  if (prior) return prior;

  const { data: ops } = await ctx.db.from("hermes_operations").select("*")
    .eq("batch_id", batchId).is("reverted_at", null).neq("entity", "batch").neq("operation", "revert").order("created_at", { ascending: false });
  if (!ops || ops.length === 0) return apiError(404, "nothing_to_revert", "Nenhuma alteração pendente de reversão neste lote.");

  const results: any[] = [];
  for (const op of ops) {
    let ok = false;
    if (op.operation === "asset_intune" || op.operation === "employee_entra") {
      ok = !(await ctx.db.from(op.entity).update(op.before_state).eq("id", op.entity_id)).error;
    } else if (op.operation === "create_assignment") {
      const r = await ctx.db.from("assignments").update({ status: "encerrado", returned_at: new Date().toISOString(), return_condition: "Revertido pelo Hermes" }).eq("id", op.entity_id).eq("status", "ativo");
      ok = !r.error;
      if (ok) await ctx.db.from("assets").update({ status: op.before_state?.asset_status ?? "disponivel" }).eq("id", op.after_state?.asset_id);
    }
    if (ok) await ctx.db.from("hermes_operations").update({ reverted_at: new Date().toISOString() }).eq("id", op.id);
    results.push({ operation_id: op.id, operation: op.operation, entity_id: op.entity_id, reverted: ok });
  }
  const response = { batch_id: batchId, correlation_id: h.corr, items: results };
  await ctx.db.from("hermes_operations").insert({
    idempotency_key: h.idem, correlation_id: h.corr, batch_id: `revert:${batchId}`, operation: "revert",
    request_hash: hash, entity: "batch", response, status_code: 200, created_by: ctx.userId,
  });
  await audit(ctx, "hermes_reverter_lote", "hermes_operations", null, { batch_id: batchId, correlation_id: h.corr, itens: results.length });
  return json(response);
}

async function dispatch(request: Request, splat: string) {
  if (!checkToken(request)) return apiError(401, "unauthorized", "Token ausente ou inválido.");
  let session;
  try {
    session = await hermesClient();
  } catch {
    return apiError(503, "service_account_unavailable", "Conta de serviço indisponível.");
  }
  const url = new URL(request.url);
  const ctx: Ctx = { db: session.client, userId: session.userId, email: session.email, request, url };
  const parts = splat.split("/").filter(Boolean);
  const m = request.method;
  try {
    if (m === "GET" && parts.length === 1 && parts[0] === "assets") return await listAssets(ctx);
    if (m === "GET" && parts.length === 3 && parts[0] === "assets" && parts[2] === "assignments") return await assetAssignments(ctx, parts[1]!);
    if (m === "GET" && parts.length === 1 && parts[0] === "employees") return await listEmployees(ctx);
    if (m === "GET" && parts.length === 2 && parts[0] === "assignments") return await getAssignment(ctx, parts[1]!);
    if (m === "POST" && parts.length === 1 && parts[0] === "assignments") return await createAssignment(ctx);
    if (m === "POST" && parts.join("/") === "mappings/preview") return await previewMappings(ctx);
    if (m === "POST" && parts.length === 1 && parts[0] === "mappings") return await applyMappings(ctx);
    if (m === "GET" && parts.length === 1 && parts[0] === "operations") return await listOperations(ctx);
    if (m === "POST" && parts.length === 3 && parts[0] === "batches" && parts[2] === "revert") return await revertBatch(ctx, parts[1]!);
    return apiError(404, "route_not_found", "Rota não encontrada.");
  } catch (e) {
    console.error("hermes-api", e);
    return apiError(500, "internal_error", "Erro interno.");
  }
}

export const Route = createFileRoute("/api/public/hermes/v1/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => dispatch(request, params._splat ?? ""),
      POST: ({ request, params }) => dispatch(request, params._splat ?? ""),
    },
  },
});
