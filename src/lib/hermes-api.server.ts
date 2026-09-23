import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

export type Db = SupabaseClient;

let cached: { client: Db; userId: string; email: string; exp: number } | null = null;

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return json({ error: { code, message, details } }, status);
}

export function checkToken(request: Request): boolean {
  const secret = process.env["HERMES_API_TOKEN"];
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || secret.length < 32 || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cliente autenticado como a conta dedicada do Hermes: toda leitura/escrita passa pela RLS. */
export async function hermesClient(): Promise<{ client: Db; userId: string; email: string }> {
  if (cached && cached.exp - 60 > Date.now() / 1000) return cached;
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env["HERMES_ASSETS_EMAIL"]!,
    password: process.env["HERMES_ASSETS_PASSWORD"]!,
  });
  if (error || !data.session) throw new Error("hermes_login_failed");
  cached = {
    client,
    userId: data.user.id,
    email: data.user.email ?? "",
    exp: data.session.expires_at ?? Date.now() / 1000 + 3000,
  };
  return cached;
}

export function hashBody(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export function pageParams(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("page_size") ?? 50) || 50));
  return { page, size, from: (page - 1) * size, to: page * size - 1 };
}

export function pageMeta(page: number, size: number, total: number | null) {
  const t = total ?? 0;
  return { page, page_size: size, total: t, total_pages: Math.max(1, Math.ceil(t / size)) };
}
