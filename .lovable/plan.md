# QR Code único por equipamento com baixa pela câmera

Cada equipamento passa a ter um QR Code próprio e permanente. Ao apontar a câmera do celular, o analista cai direto numa tela de confirmação que registra a devolução do equipamento em um toque.

## Como vai funcionar

1. O QR impresso na etiqueta aponta para um endereço exclusivo daquele equipamento.
2. Ao ler com a câmera, abre a tela "Registrar devolução" no sistema. Se a pessoa não estiver conectada, entra primeiro e volta automaticamente para a mesma tela.
3. A tela mostra foto do modelo, marca, modelo, série, patrimônio, situação atual e quem está com o equipamento hoje.
4. Um botão grande "Confirmar devolução" encerra o vínculo, marca o equipamento como Disponível e registra a data.
5. Antes de confirmar, o analista pode preencher o checklist de devolução já existente (liga, tela, teclado, carregador, acessórios) com fotos opcionais, e anotar a condição do equipamento.
6. Casos especiais tratados na mesma tela:
   - equipamento sem responsável: avisa que não há vínculo ativo e oferece as ações de vincular ou abrir a ficha;
   - equipamento já devolvido: mostra a última devolução registrada;
   - conferência de inventário aberta: além da devolução, oferece "Marcar como conferido" nessa conferência;
   - quem não tem permissão de edição vê os dados do equipamento, sem os botões de baixa.
7. Depois de confirmar, a tela mostra o resultado com opção de desfazer por alguns segundos e um botão "Ler outro equipamento".
8. Tudo fica registrado na auditoria e na linha do tempo do equipamento e do colaborador.

A folha de etiquetas continua com o mesmo formato atual (QR, nome e série) — só o endereço dentro do QR muda para o novo fluxo de baixa. Etiquetas já impressas continuam funcionando: o endereço antigo passa a levar para a mesma tela.

## Detalhes técnicos

- Nova rota `src/routes/_authenticated/qr.$assetId.tsx`: carrega o ativo com vínculo ativo (`assignments` status `ativo` + `employees`), mostra resumo e executa a baixa.
- Mutação de devolução reaproveitando a lógica de `vinculos.tsx`: `assignments` → `status='encerrado'`, `returned_at`, `return_condition`; `assets.status='disponivel'`; `saveAssignmentChecklist` de `assignment-checklist.tsx` com `kind='devolucao'`; `logAudit` (`action: 'baixa_qr'`).
- Desfazer: reverte o vínculo para `ativo` e o ativo para `em_uso` dentro da janela de alguns segundos, com registro próprio na auditoria.
- `openQrSheet` em `src/lib/export.ts` passa a gerar `${origin}/qr/${asset.id}`; `src/routes/_authenticated/ativos.$id.tsx` mantém a ficha e a rota antiga segue válida.
- Guarda de sessão: o subconjunto `_authenticated` já redireciona para o login; o caminho de retorno é preservado via `redirect` com `search.redirect` para voltar ao QR após entrar.
- Conferência de inventário: consulta a sessão `inventory_sessions` com `status='aberta'` mais recente e insere em `inventory_checks` quando o analista escolher marcar como conferido.
- Sem migração de banco: todas as tabelas necessárias já existem.
- Verificação: typecheck e teste no navegador (viewport de celular) simulando a leitura de um QR de equipamento com e sem vínculo ativo.
