# Painel lateral de edição + refino visual do sistema

## 1. Clicar no ativo abre um painel lateral (sem trocar de tela)

Ao clicar na linha do equipamento, abre um painel deslizante ancorado à esquerda da tela, sobre a lista, com animação suave de entrada/saída. A lista continua visível e o endereço da página não muda.

Conteúdo do painel:
- Topo: ícone do tipo de equipamento, marca + modelo, série, selos de situação/tipo/origem.
- Abas internas: **Dados** (formulário editável), **Uso** (usuário atual e histórico de vínculos), **Documentos** (termos e PDFs assinados).
- Formulário editável direto no painel: tipo, situação, marca, modelo, série, patrimônio, IMEI, fornecedor, contrato, localidade, condição, custo mensal, início/fim da locação, observações. Botões Salvar e Cancelar fixos no pé do painel; salvar grava, registra na auditoria e atualiza a lista na hora.
- Quem não tem permissão de edição vê os mesmos dados em modo leitura.
- Ações rápidas continuam disponíveis no painel: vincular a uma pessoa, registrar devolução, enviar termo para assinatura, marcar em manutenção / disponível.
- Link "Abrir ficha completa" mantém a tela de detalhe existente para quem quiser a visão ampla.
- Navegação por teclado: Esc fecha, setas passam para o ativo anterior/seguinte.

O mesmo padrão de painel lateral é aplicado em Colaboradores, para manter a experiência consistente.

## 2. Refino visual do sistema

Identidade turquesa + roxo mantida, com acabamento mais moderno:

- **Painel (dashboard)**: cartões de indicadores com ícone, variação e microgradiente; gráfico de rosca por situação dos equipamentos; gráfico de barras por tipo (notebook, celular, etc.); linha de vínculos criados nos últimos meses; lista de locações vencendo com barra de proximidade do prazo.
- **Listas**: linhas com realce ao passar o mouse, linha selecionada destacada, contagem de resultados, chips de filtro ativo, estado vazio ilustrado, esqueletos de carregamento em vez de "Carregando…".
- **Selos e status**: paleta consistente com ponto colorido, tamanho e espaçamento unificados.
- **Menu lateral**: item ativo com marcador e transição, agrupamento por área, badge de pendências em Termos.
- **Movimento**: entrada suave de cartões e linhas, transições em abas, painel e diálogos; contadores que animam até o valor; tudo discreto e rápido.
- **Acabamento geral**: sombras e cantos padronizados, tipografia hierarquizada (Sora nos títulos), cabeçalhos de página com trilha de navegação, densidade de tabela mais confortável, revisão de responsivo no mobile.

## Detalhes técnicos

- Painel lateral com o componente `sheet` (side="left"), largura ~520px, conteúdo com rolagem e rodapé fixo; estado do ativo selecionado controlado por `useState` em `ativos.index.tsx` (sem mudar rota).
- Novo `src/components/asset-detail-panel.tsx` reutilizando `AssetIcon`, `StatusBadge`, `SourceBadge`, `DocumentsPanel`; mutação de update em `assets` via Supabase + `logAudit`, invalidando `["assets"]`.
- Formulário de criação passa a reutilizar os mesmos campos do painel (um só componente de campos).
- Gráficos com o `chart.tsx` (Recharts) já presente no projeto; dados derivados das consultas existentes, sem novas tabelas.
- Refino de tokens (sombras, raios, gradientes) em `src/styles.css`; sem cores fixas nos componentes.
- Nada muda no banco de dados nem nas regras de acesso.
