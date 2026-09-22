# Ficha e lista de ativos no estilo das referências

Objetivo: deixar a área de ativos parecida com as telas de gestão de dispositivos enviadas — cabeçalho com ícone do equipamento, selos de situação, ações rápidas à esquerda e dados organizados em abas com campos em colunas.

## Lista de ativos

- Cada linha passa a mostrar um ícone do tipo de equipamento (notebook ou celular) ao lado do nome.
- Nome em destaque, com série e patrimônio logo abaixo em texto menor.
- Selos coloridos na linha: situação (disponível, em uso, manutenção, devolvido) e origem quando houver (Intune, planilha).
- Colunas mais enxutas: Equipamento · Usuário atual · Fornecedor · Locação · Situação. Custo e demais dados ficam na ficha.
- Busca e filtros continuam como estão.

## Ficha do equipamento

Cabeçalho superior:
- Ícone grande do equipamento, nome (marca + modelo) e número de série.
- Linha de selos: situação, tipo, fornecedor, e "Última sincronização" quando existir.

Coluna lateral esquerda (ações rápidas):
- Vincular a uma pessoa (abre o fluxo de vínculo, que já gera o termo).
- Registrar devolução (quando o equipamento está em uso).
- Enviar termo para assinatura (quando há termo pendente).
- Marcar em manutenção / voltar para disponível.
- Cada ação respeita o papel do usuário: quem não tem permissão de edição só visualiza.

Conteúdo em abas:
1. **Detalhes** — campos agrupados em blocos de duas a quatro colunas:
   - Hardware: tipo, marca, modelo, condição.
   - Identificação: número de série, patrimônio, IMEI.
   - Contrato: fornecedor, número do contrato, custo mensal, início e fim da locação.
   - Gestão: localidade, última sincronização, observações.
2. **Usuário e histórico** — usuário atual em destaque (nome, e-mail, data de entrega) e abaixo a lista de vínculos anteriores.
3. **Documentos** — termos gerados e PDFs assinados, como já funciona hoje.

## Observações técnicas

- Alterações apenas de apresentação: `src/routes/_authenticated/ativos.tsx` e `ativos.$id.tsx`, mais um componente novo de bloco de campos (`field-grid`) e um de ícone por tipo de ativo.
- Abas com o componente `Tabs` do shadcn já presente no projeto.
- Ações rápidas reutilizam as consultas e mutações já existentes de vínculos, devolução e envio de termo; nenhuma mudança no banco de dados.
- Selos continuam usando o `StatusBadge` atual; apenas ganham variação para origem dos dados.
- Cores e tipografia seguem os tokens da Órigo já definidos em `src/styles.css`.
