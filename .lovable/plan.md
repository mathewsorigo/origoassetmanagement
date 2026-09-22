# Visual e funções no estilo do sistema de referência

Deixar o Órigo Asset Management com a mesma linguagem visual e os mesmos recursos de operação das telas de referência, mantendo o turquesa da Órigo. A página de apresentação sai: a primeira tela passa a ser o login (quem já está logado cai direto no Painel).

## 1. Entrada no sistema

- O endereço inicial mostra o login com o logotipo grande, sem página de apresentação.
- Quem já tem sessão ativa vai direto para o Painel.
- "Primeiro acesso", login com Microsoft e recuperação de senha continuam iguais.

## 2. Estrutura de tela igual à referência

- Menu lateral escuro e estreito, com ícone grande por área, rótulo curto embaixo, item ativo destacado e contador de pendências (termos a assinar, locações vencendo).
- Cabeçalho fixo com busca global ("Encontre o que você procura...") que pesquisa equipamentos, colaboradores e vínculos, com resultados agrupados e atalho de teclado.
- Ao lado da busca: botão verde "Novo" com menu (equipamento, colaborador, vínculo), botão de etiquetas e avatar do usuário com menu de conta e sair.
- Cada página começa com o mesmo cabeçalho de objeto/título e faixa de abas.

## 3. Lista de equipamentos

- Caixas de seleção por linha e no cabeçalho, com barra inferior fixa mostrando "X de Y equipamentos" e as ações do grupo: Editar, Etiquetas, Exportar e Excluir.
- Menu de três pontos por linha (editar, excluir, etiquetas, gerar QR Code) — já existente, ampliado.
- Menu Exportar com CSV, XLSX e "Gerar QR Code dos selecionados" (folha imprimível com o QR e a identificação de cada equipamento).
- Filtros por tipo, situação, fornecedor e etiqueta, com chips do que está aplicado e contagem de resultados.
- Paginação no rodapé, ícone por tipo de equipamento e selos coloridos como hoje.

## 4. Ficha e popup do equipamento

- Popup à direita mantido, com o cabeçalho no formato da referência: ícone grande, código/nome, tipo e "Atualizado em ...".
- Cartões de estado no topo (Situação, Localidade, Responsável) com lápis para editar direto no cartão.
- Abas: Início (resumo), Hardware, Contrato, Uso, Documentos e Atividade (histórico de alterações vindo da auditoria).
- Bloco de Etiquetas com as etiquetas coloridas e botão para editar.
- Números grandes em destaque no resumo (dias em uso, custo mensal, documentos assinados).

## 5. Etiquetas (tags)

- Etiquetas livres com cor, criadas e administradas pelo administrador.
- Aplicáveis a um equipamento no popup ou a vários pelo grupo selecionado.
- Filtro por etiqueta nas listas e contagem por etiqueta no painel.

## 6. Painel

- Cartões de indicadores no estilo da referência, com barra colorida à esquerda, ícone e valor grande.
- Gráfico de pizza por situação, barras por tipo, linha de vínculos por mês e lista de locações vencendo.
- Blocos "Total de equipamentos", "Custo mensal total" e "Termos pendentes" com link para a lista filtrada.

## 7. Colaboradores

- Mesma lista com seleção múltipla, exportação, menu por linha e popup no mesmo formato (abas Início, Equipamentos, Documentos, Atividade).

## Detalhes técnicos

- Remover `src/routes/index.tsx` como landing: passa a renderizar o login (reaproveitando o conteúdo de `auth.tsx`) e a redirecionar sessões ativas para `/painel`; `head()` próprio de cada rota mantido.
- Novo shell: `src/components/app-shell.tsx` (sidebar em ícones + topbar), `src/components/global-search.tsx` (Command dialog do shadcn consultando assets/employees), `src/components/object-header.tsx`, `src/components/bulk-action-bar.tsx`, `src/components/tag-picker.tsx`.
- Tokens em `src/styles.css`: sidebar escura em grafite-turquesa, superfícies claras, sombra e raio padronizados; nenhuma cor escrita direto nos componentes.
- Migração nova: tabelas `tags` (nome, cor) e `asset_tags` (asset_id, tag_id) com GRANT + RLS (leitura para autenticados, escrita para operadores via `has_role`); auditoria em toda alteração.
- Exportação usa o `src/lib/excel.ts` existente (XLSX) e um gerador de CSV; QR Code com a biblioteca `qrcode` renderizando uma folha imprimível com o link da ficha.
- Aba Atividade lê o `audit_log` filtrado por entidade e id.
- Sem mudança nas regras de permissão existentes; exclusão e edição seguem restritas a quem tem papel de operação.
