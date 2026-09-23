import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const storageKey = "origo-local-preview";

export function isLocalPreviewAvailable() {
  return import.meta.env.DEV &&
    import.meta.env['VITE_LOCAL_PREVIEW'] === "true" &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

export function isLocalPreview() {
  return isLocalPreviewAvailable() && sessionStorage.getItem(storageKey) === "true";
}

export function hasLocalPreviewData() {
  return isLocalPreviewAvailable() && import.meta.env['VITE_LOCAL_PREVIEW_DATA'] === "true";
}

export function enterLocalPreview() {
  if (!isLocalPreviewAvailable()) return;
  sessionStorage.setItem(storageKey, "true");
  window.location.assign("/painel");
}

export function exitLocalPreview() {
  sessionStorage.removeItem(storageKey);
  window.location.assign("/");
}

// UI-only identity. This is never installed as a Supabase auth session.
export const previewSession: Session = {
  access_token: "",
  refresh_token: "",
  expires_in: 0,
  token_type: "bearer",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "local-preview",
    email: "demonstracao@origoenergia.com.br",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
};

export const previewProfile: Database["public"]["Tables"]["profiles"]["Row"] = {
  id: previewSession.user.id,
  email: previewSession.user.email!,
  full_name: "Demonstração local",
  status: "ativo",
  avatar_url: null,
  job_title: null,
  phone: null,
  invited_at: null,
  last_sign_in_at: null,
  created_at: previewSession.user.created_at,
  updated_at: previewSession.user.created_at,
};

// Keep preview requests offline, including when a real session exists in storage.
export const localPreviewFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname.startsWith("/rest/v1/") &&
      !url.pathname.startsWith("/rest/v1/rpc/") &&
      ["GET", "HEAD"].includes(request.method)) {
    if (hasLocalPreviewData()) {
      // Forward only query options, never the cloud credentials or bearer token.
      const headers = new Headers();
      for (const name of ["accept", "prefer", "range", "range-unit"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      return fetch(`/__local-data/${url.pathname.slice("/rest/v1/".length)}${url.search}`, {
        method: request.method,
        headers,
        signal: request.signal,
        credentials: "omit",
      });
    }
    const single = request.headers.get("accept")?.includes("vnd.pgrst.object");
    return new Response(request.method === "HEAD" ? null : JSON.stringify(single ? null : []), {
      status: 200,
      headers: { "content-type": "application/json", "content-range": "*/0" },
    });
  }
  return new Response(JSON.stringify({ message: "A demonstração local é somente para visualização. Entre com Microsoft para usar os dados reais." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
};
