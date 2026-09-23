export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatMoney(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const assetTypeLabel: Record<string, string> = {
  notebook: "Notebook",
  celular: "Celular",
  monitor: "Monitor",
  acessorio: "Acessório",
  outro: "Outro",
};

export const assetStatusLabel: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  devolvido: "Devolvido",
  extraviado: "Extraviado",
};

export const agreementStatusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  visualizado: "Visualizado",
  assinado: "Assinado",
  recusado: "Recusado",
  expirado: "Expirado",
};

export const employeeStatusLabel: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  afastado: "Afastado",
};

export const roleLabel: Record<string, string> = {
  admin: "Administrador",
  ti: "TI",
  gestor: "Gestor",
  colaborador: "Colaborador",
};
