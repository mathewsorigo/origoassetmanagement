# Refino visual corporativo + novas ferramentas de gestão

Objetivo: tirar a aparência genérica e deixar o sistema fino, corporativo e denso de informação útil, com novas formas de visualizar e gerenciar os equipamentos.

## 1. Refino visual (todas as telas)

- Tipografia: títulos mais compactos e firmes, corpo de texto em tamanho menor e uniforme, números dos indicadores em variante tabular (alinhados em colunas).
- Caixas e cartões: bordas mais finas, cantos menos arredondados, sombra quase imperceptível, espaçamento interno padronizado. Fim do excesso de gradientes e brilhos.
- Cabeçalho de página unificado: título, caminho da área (Início › Equipamentos), descrição curta e ações à direita; abaixo, faixa de abas fina.
- Selos de situação em tom pastel com ponto de cor, em vez de blocos saturados.
- Botões, campos e menus com altura e cantos consistentes em todo o sistema.
- Barra superior e menu lateral mais discretos, com item ativo marcado por linha fina.
- Estados vazios com ícone, frase curta e um botão de ação; esqueletos de carregamento em todas as telas.

## 2. Listas: cartões, colunas e filtros salvos

- Botão para alternar **tabela** ou **cartões** (grade com foto do equipamento, nome, série, situação e responsável); a escolha fica guardada.
- Seletor de colunas: escolher o que aparece na tabela (série, patrimônio, modelo, tipo, situação, responsável, localidade, fornecedor, fim da locação, etiquetas); guardado por tela.
- Filtros salvos: nomear o conjunto de filtros atual (ex.: "Notebooks em manutenção") e reaplicar em um clique; chips mostrando filtros ativos com "limpar tudo".
- Vale para Equipamentos e Colaboradores; Vínculos e Termos ganham o seletor de colunas e filtros salvos.

## 3. Linha do tempo por equipamento e por pessoa

- Nova aba "Linha do tempo" nos popups de equipamento e de colaborador: cadastro, vínculos, devoluções, termos enviados/assinados, manutenções, importações e alterações, em ordem cronológica, com ícone e cor por tipo de evento e agrupamento por mês.
- Monta a partir dos vínculos, termos, documentos e da auditoria já existentes — nenhum dado novo é necessário.

## 4. Central de integrações

- Tela de Integrações reformulada: um cartão por integração (hermes-agent, Intune, Simpress, Easy) com estado (Conectada / Não configurada / Com erro), última sincronização, quantidade de itens trazidos na última execução e botões Testar conexão e Sincronizar agora.
- Histórico das execuções abaixo, com data, resultado e mensagem de erro quando houver.
- Enquanto as credenciais não existirem, o cartão mostra claramente o que falta preencher.

## 5. Painel

- Indicadores com número grande tabular, variação e link para a lista já filtrada.
- Gráficos mais sóbrios (sem brilhos), rosca por situação, barras por tipo, linha de vínculos por mês.
- Novos blocos: equipamentos sem responsável, termos pendentes há mais tempo, locações vencendo e últimas atividades do sistema.

## Detalhes técnicos

- Ajuste dos tokens em `src/styles.css` (escala tipográfica, raios, sombras, tons dos selos) — sem cores fixas nos componentes.
- Componentes novos: `column-picker.tsx`, `saved-views.tsx`, `view-toggle.tsx`, `asset-card-grid.tsx`, `timeline.tsx`, `integration-card.tsx`, `empty-state.tsx`; refino em `page-header.tsx`, `stat-card.tsx`, `status-badge.tsx`, `ui/table.tsx`, `ui/card.tsx`, `ui/button.tsx`.
- Novo hook `useTableView` (visão, colunas e filtros salvos em localStorage por tela), reaproveitando `useTableState`.
- Linha do tempo lê `assignments`, `agreements`, `documents` e `audit_log` com as políticas atuais; nenhuma migração de banco necessária.
- Integrações continuam usando `integration_settings` e `integration_runs` já existentes.
- Sem mudanças em regras de permissão: edição e exclusão seguem restritas aos papéis atuais.
