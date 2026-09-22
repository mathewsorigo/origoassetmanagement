import { assetTypeLabel } from "./format";

type EmployeeLike = {
  full_name: string;
  email: string;
  cpf?: string | null;
  job_title?: string | null;
  department?: string | null;
};

type AssetLike = {
  asset_type: string;
  brand?: string | null;
  model?: string | null;
  serial_number: string;
  patrimony?: string | null;
  imei?: string | null;
  supplier?: string | null;
};

export function renderAgreement(
  template: string,
  employee: EmployeeLike,
  asset: AssetLike,
  extra: { deliveryDate?: string; deliveryCondition?: string } = {},
) {
  const today = new Date().toLocaleDateString("pt-BR");
  const map: Record<string, string> = {
    colaborador_nome: employee.full_name,
    colaborador_email: employee.email,
    colaborador_cpf: employee.cpf || "não informado",
    colaborador_cargo: employee.job_title || "não informado",
    colaborador_area: employee.department || "não informada",
    ativo_tipo: assetTypeLabel[asset.asset_type] ?? asset.asset_type,
    ativo_marca: asset.brand || "",
    ativo_modelo: asset.model || "",
    ativo_serie: asset.serial_number,
    ativo_patrimonio: asset.patrimony || "não informado",
    ativo_imei: asset.imei || "não aplicável",
    fornecedor: asset.supplier || "Simpress",
    condicao_entrega: extra.deliveryCondition || "Novo / em perfeito estado",
    data_entrega: extra.deliveryDate
      ? new Date(extra.deliveryDate).toLocaleDateString("pt-BR")
      : today,
    data_hoje: today,
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => map[key] ?? "");
}
