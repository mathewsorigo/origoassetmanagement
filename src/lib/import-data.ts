import { calendarDate, parseMoney, validatePeriod } from "./validation";

const fields: Record<string, string[]> = {
  serial_number: ["serial", "serie", "numero_de_serie", "serial_number", "n_serie"],
  asset_type: ["tipo", "tipo_de_ativo", "categoria"],
  brand: ["marca", "fabricante"],
  model: ["modelo", "model"],
  patrimony: ["patrimonio", "patrimonio_n", "ativo_fixo"],
  imei: ["imei"],
  supplier: ["fornecedor", "locadora"],
  contract_number: ["contrato", "contrato_numero"],
  location: ["localidade", "local", "unidade"],
  last_seen_location: ["ultima_localidade_vista", "localidade_vista", "last_seen_location"],
  bitdefender_installed: ["bitdefender_instalado", "bitdefender", "bitdefender_installed"],
  monthly_cost: ["custo_mensal", "valor_mensal", "custo"],
  lease_start: ["inicio_locacao", "inicio", "data_inicio"],
  lease_end: ["fim_locacao", "fim", "data_fim", "vencimento"],
  full_name: ["nome", "nome_completo", "colaborador"],
  email: ["email", "e_mail", "email_corporativo"],
  cpf: ["cpf"],
  phone: ["telefone", "celular", "fone"],
  job_title: ["cargo", "funcao"],
  department: ["area", "departamento", "setor"],
  unit: ["unidade", "filial", "local"],
  manager_name: ["gestor", "lider", "responsavel"],
};
const employeeFields = [
  "full_name",
  "email",
  "cpf",
  "phone",
  "job_title",
  "department",
  "unit",
  "manager_name",
];
export function importPayload(row: Record<string, unknown>, kind: string) {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_"),
      value,
    ]),
  );
  const result: Record<string, string | number | boolean | null> = {};
  for (const [field, aliases] of Object.entries(fields)) {
    if ((kind !== "ativos") !== employeeFields.includes(field)) continue;
    const key = aliases.find(
      (k) => normalized[k] !== undefined && String(normalized[k]).trim() !== "",
    );
    if (!key) continue; // Missing column AND blank cell preserve existing data.
    const raw = String(normalized[key]).trim();
    if (raw === "[LIMPAR]") {
      result[field] = null;
      continue;
    }
    if (field === "monthly_cost") result[field] = parseMoney(raw);
    else if (field.startsWith("lease_")) result[field] = calendarDate(raw);
    else if (field === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error("E-mail inválido.");
      result[field] = raw.toLowerCase();
    } else if (field === "bitdefender_installed") {
      if (
        ![
          "sim",
          "s",
          "true",
          "1",
          "yes",
          "instalado",
          "não",
          "nao",
          "n",
          "false",
          "0",
          "no",
        ].includes(raw.toLowerCase())
      )
        throw new Error("Informe sim ou não para proteção.");
      result[field] = ["sim", "s", "true", "1", "yes", "instalado"].includes(raw.toLowerCase());
    } else if (field === "asset_type") {
      const types: Record<string, string> = {
        notebook: "notebook",
        laptop: "notebook",
        celular: "celular",
        smartphone: "celular",
        telefone: "celular",
        monitor: "monitor",
        acessorio: "acessorio",
        outro: "outro",
      };
      const value =
        types[
          raw
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
        ];
      if (!value) throw new Error("Tipo de equipamento inválido.");
      result[field] = value;
    } else result[field] = raw;
  }
  if (!(kind === "ativos" ? result["serial_number"] : result["email"]))
    throw new Error(kind === "ativos" ? "Número de série obrigatório." : "E-mail obrigatório.");
  validatePeriod(result["lease_start"] as string | null, result["lease_end"] as string | null);
  return result;
}
