const KEY = "origo:qr-pendente";

/** Guarda o equipamento lido por QR quando a pessoa ainda não está conectada. */
export function rememberPendingQr(pathname: string) {
  const match = /^\/qr\/([0-9a-f-]{36})/i.exec(pathname);
  if (match?.[1] && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(KEY, match[1]);
  }
}

/** Devolve (e limpa) o equipamento pendente de baixa por QR. */
export function takePendingQr(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(KEY);
  if (value) sessionStorage.removeItem(KEY);
  return value;
}
