# Tabelas: paginação, ordenação e visual refinado

## O que muda para você

### 1. Paginação com escolha de quantidade
No pé de cada tabela aparece uma barra com:
- seletor "Itens por página": 10, 25, 50 ou 100 (25 continua o padrão);
- texto "Mostrando 1–25 de 1.076";
- botões primeira / anterior / próxima / última página e indicador "Página 3 de 44".

Trocar filtro, busca ou quantidade por página volta para a página 1. A escolha de quantidade fica guardada no navegador, então continua igual na próxima visita.

### 2. Ordenação A–Z / Z–A nas colunas
Cada título de coluna que faz sentido ordenar vira um botão: clique ordena A–Z, clique novamente Z–A, terceiro clique volta à ordem original. Uma setinha mostra a direção ativa e a coluna ordenada fica destacada. Datas ordenam por data, textos por ordem alfabética (acentos tratados corretamente), campos vazios vão sempre para o fim.

Colunas ordenáveis por tela:
- Equipamentos: Equipamento (marca/modelo), Usuário atual, Fornecedor, Locação, Situação.
- Colaboradores: Nome, E-mail, Departamento, Situação.
- Vínculos: Equipamento, Colaborador, Data de entrega, Situação.
- Termos: Colaborador/Equipamento, Data, Situação.
- Acessos: Pessoa, Situação, Convite, Último acesso.
- Auditoria: Data, Quem, Ação.

### 3. Visual mais refinado
- Cabeçalho da tabela fixo ao rolar, com fundo suave e texto em caixa alta discreta.
- Linhas com altura um pouco maior, respiro lateral e faixa alternada muito leve para acompanhar a leitura.
- Ao passar o mouse, a linha ganha realce e uma fina marca na borda esquerda; a linha aberta no popup fica destacada.
- Selos de situação e etiquetas alinhados, com espaçamento uniforme.
- Menu de três pontos aparece com mais clareza ao passar o mouse na linha.
- Tabela dentro de um cartão com cantos arredondados e borda leve; rolagem horizontal suave em telas estreitas.
- Estados vazios e esqueletos de carregamento mantidos, ajustados ao novo espaçamento.
- Paginação e barra de ações em massa convivem sem sobrepor.

Nada muda nas permissões, nos dados ou nas ações existentes.

## Detalhes técnicos

- Novo `src/components/data-table-ui.tsx`: `SortableHead` (título clicável com ícone `ArrowUpDown`/`ArrowUp`/`ArrowDown`) e `TablePagination` (Select de 10/25/50/100 + navegação), ambos com tokens semânticos.
- Novo hook `src/hooks/useTableState.ts`: `useTableState<T>(rows, { key, defaultSort })` devolve `sortKey`, `sortDir`, `toggleSort`, `pageSize`, `setPageSize`, `page`, `setPage`, `pageRows`, `total`, `range`. Ordenação via comparador com `Intl.Collator("pt-BR")`, nulos por último; `pageSize` persistido em `localStorage` por tabela; `useEffect` reseta a página quando o total/filtros mudam.
- `src/components/ui/table.tsx`: `TableHead` com `sticky top-0 bg-muted/60 backdrop-blur` + `text-[11px] uppercase tracking-wide`; `TableRow` com `hover:bg-primary/[0.04]` e borda esquerda transparente que aparece no hover/seleção; `TableCell` com `px-3 py-3`.
- Adotar o hook em `ativos.index.tsx` (remove `pageSize = 25` fixo e o `slice` manual), `pessoas.index.tsx`, `vinculos.tsx`, `termos.tsx`, `administracao.tsx`, `auditoria.tsx`; cada tela define `accessor` por coluna.
- Paginação renderizada em `TableFooter`/rodapé do cartão, com `mb` extra quando a `BulkActionBar` estiver visível.
- Seleção em massa continua por id; "selecionar todos" segue aplicando à página atual.
