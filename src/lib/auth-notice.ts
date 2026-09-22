const KEY = "origo:auth-notice";

export function setAuthNotice(message: string) {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    /* ignore */
  }
}

export function takeAuthNotice(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}

/** Traduz os erros que o provedor devolve na URL de retorno do login. */
export function translateAuthError(code: string, description: string): string {
  const text = `${code} ${description}`.toLowerCase();
  if (text.includes("nao esta liberado") || text.includes("não está liberado")) {
    return "Seu e-mail ainda não foi liberado para acessar o sistema. Fale com um administrador.";
  }
  if (text.includes("origoenergia")) {
    return "Use sua conta corporativa @origoenergia.com.br para entrar.";
  }
  if (text.includes("access_denied")) {
    return "O login foi cancelado ou não foi autorizado. Tente novamente.";
  }
  return description || "Não foi possível concluir o login. Tente novamente.";
}

export function readAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = query.get("error_code") ?? hash.get("error_code") ?? query.get("error") ?? hash.get("error") ?? "";
  const description =
    query.get("error_description") ?? hash.get("error_description") ?? "";
  if (!code && !description) return null;
  window.history.replaceState({}, "", window.location.pathname);
  return translateAuthError(code, decodeURIComponent(description.replace(/\+/g, " ")));
}
