# Busca por nome em Vínculos + QR totalmente responsivo no celular

## 1. Barra de pesquisa na aba Vínculos
- Campo "Buscar colaborador…" acima da tabela, com ícone de lupa e botão para limpar.
- Filtra somente pelo nome do colaborador (ignora maiúsculas e acentos, ex.: "joao" encontra "João").
- Mostra contagem "X vínculos encontrados" e mensagem amigável quando nada for encontrado.
- Paginação volta para a página 1 ao digitar.

## 2. Vínculos no celular
- Em telas pequenas, a tabela vira uma lista de cartões (nome, equipamento, série, data de entrega, status e ações), sem rolagem lateral nem texto cortado.
- Botão "Novo vínculo" ocupa a largura toda no celular.

## 3. Todas as etapas do QR Code no celular
Tela aberta ao escanear o QR (ficha do equipamento, devolução, checklist, fotos, confirmação, desfazer em 20 s, conferência de inventário e modo somente leitura):
- Layout em uma coluna, sem rolagem lateral, textos quebrando corretamente (séries e nomes longos).
- Botões principais grandes (fáceis de tocar) e fixos no rodapé da tela durante a devolução/conferência.
- Checklist com itens em lista de toque amplo; envio de fotos abrindo a câmera direto e miniaturas em grade ajustável.
- Janelas de confirmação ocupando a tela no celular.
- Diálogo "Ver QR Code" e impressão ajustados para caber na tela.

## Verificação
- Testar em largura de celular (390 px) a aba Vínculos e cada etapa do QR, conferindo por capturas de tela que nada fica cortado.

## Detalhes técnicos
- `vinculos.tsx`: estado `nameQuery`, filtro com `normalize("NFD")` sobre `employee.full_name`; tabela `hidden md:block` + lista de cards `md:hidden`.
- `qr.$assetId.tsx` e `asset-qr-dialog.tsx`: `min-w-0`, `break-words`, grid `grid-cols-1 sm:grid-cols-2`, barra de ações `sticky bottom-0` com `pb-[env(safe-area-inset-bottom)]`, `input capture="environment"`, diálogos `max-sm:h-dvh max-sm:max-w-full`.
- Somente mudanças visuais/filtro no navegador; sem alterações de banco.
