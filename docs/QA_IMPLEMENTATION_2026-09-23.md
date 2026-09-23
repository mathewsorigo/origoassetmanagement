# Correções da avaliação de QA — 23/09/2026

Implementação local dos 18 achados e das melhorias adicionais de `QA_REVIEW_2026-09-23.md`.
Marca, nomes, proposta de pendências do painel e apresentação do Bitdefender foram preservados.
Este documento registra a implementação; não substitui homologação dos serviços reais.

## Entregas

| Achado | Correção implementada |
|---|---|
| QA-01 | Ficha por URL reutiliza a ficha central. Entrega, devolução, QR e transferência Hermes usam transações. Arquivados são rejeitados; a data enviada pelo Hermes é validada. |
| QA-02 | Importação preserva colunas ausentes/células vazias, permite `[LIMPAR]` explícito e apresenta antes/depois antes da confirmação. |
| QA-03 | Restrições no banco impedem ativo disponível com vínculo ativo e ativo em uso sem vínculo. Cadastro novo não oferece Em uso. |
| QA-04 | Todos os checks são paginados. Faltantes são recalculados e alterados em uma transação no banco. |
| QA-05 | Contratos agrupados por fornecedor + número; campos heterogêneos são preservados se não editados; alteração/remoção dos itens é atômica. |
| QA-06 | Substituição de papéis, finalização de convite e liberação de e-mail usam transações. Erros são verificados; falhas após Auth têm compensação e mensagem explícita quando exigem conciliação. |
| QA-07 | Envio reserva uma chave antes de chamar o agente. Falha ambígua fica pendente de conferência e bloqueia reenvio automático. Existe conciliação por envelope confirmado. |
| QA-08 | Sessão guarda os ativos do escopo e cada check guarda os atributos do ativo. Sessões encerradas não aceitam alterações. |
| QA-09 | Parser de moeda brasileira preserva zero; datas e períodos são validados. Leitor CSV não converte previamente datas e números brasileiros. |
| QA-10 | Estados de erro com tentativa novamente em acessos, termos, documentos, auditoria e outras consultas corrigidas. Erro não é apresentado como ausência de cadastros. |
| QA-11 | Auditoria resolve autor pelo perfil/ID; falha de auditoria passa a ser informada. |
| QA-12 | Envio inclui assunto, mensagem, prazo e lembretes. Cobrança usa lembrete_dias e respeita a chave de ativação. Configurações explicam a dependência do agente para e-mails automáticos. |
| QA-13 | Sem termos, taxa mostra Sem dados. Cobertura dos vínculos aparece separadamente. |
| QA-14 | Documento e assinatura são registrados juntos. Hash do arquivo permite retomar o mesmo upload sem duplicá-lo. Webhook é transacional, repetível e não rebaixa termo assinado. Download trata erros. |
| QA-15 | Fichas preservam rascunho, impedem navegação interna acidental e detectam conflito por versão. Invalidação de consultas relacionadas foi ampliada. |
| QA-16 | Checklist começa Não verificado e exige confirmação explícita. Integração registra motivo de dispensa, sem fingir inspeção física. |
| QA-17 | Busca global usa apenas a filtragem do servidor, trata caracteres especiais e mostra carregamento, erro e links para todos os resultados. |
| QA-18 | Rótulos associados aos campos, Fechar em português, singular/plural e rolagem de tabelas ajustados. Verificação de interface em desktop e largura de 390 pixels. |

Melhorias adicionais: auditoria com histórico completo, filtros de período/autor/entidade e exportação; termos e inventários com paginação no servidor; importação com progresso, pausa, retomada e relatório completo; quantidade sem contrato separada; integração distingue solicitação aceita de conclusão, sem atualizar horário de sincronização apenas por aceite.

## Evidência de validação

- `node node_modules/typescript/bin/tsc --noEmit`.
- `node node_modules/vite/bin/vite.js build`: cliente e servidor compilados.
- `node scripts/rebuild-qa-db.mjs`: recria exclusivamente `origo_workflow_test` em `127.0.0.1:54330` a partir do backup local.
- `node scripts/test-workflows.mjs`: autorização de funções, falha na última gravação, entregas concorrentes, devolução, arquivamento em lote e histórico preservado.
- `node scripts/test-qa.mjs`: moeda/data e CSV real; importação parcial e retomada; consistência de vínculo; transferência revertida integralmente sob erro; custos heterogêneos; papéis e convite atômicos; assinatura e webhook repetidos; conferência de 1.105 ativos, escopo congelado e fechamento imutável.
- `node scripts/test-dispatch.mjs`: agente simulado aceita envio, persistência falha, aplicação não anuncia sucesso e nova tentativa não chama novamente o agente.
- Navegador local: busca 1040 mostra seis sugestões e Ver todos abre os 31 resultados; Termos mostra Sem dados e cobertura 0/365; auditoria acessa 1.427 ações; cadastro de ativos apresenta campos nomeados; prévia CSV identifica data inválida e bloqueia confirmação; Acessos mostra erro esperado da demonstração sem sessão real. Importação conferida em 390 × 844.
- ESLint geral executado: ainda há apontamentos de formatação CRLF e avisos no conjunto do repositório. Não houve erro de regras de hooks ou de análise sintática. Isso não foi tratado como aprovação geral do lint.

Nenhum dado foi gravado no Lovable Cloud e nenhum e-mail/envelope real foi enviado. A demonstração continua somente consulta; testes de gravação usaram a base descartável. O backup original foi preservado.

## Banco e publicação

Aplicar, em ordem e cada arquivo em uma transação, as migrações `0013_consistent_asset_workflows.sql` e `0014_qa_consistency.sql` no ambiente de homologação antes de publicar a versão correspondente. Ambas já foram aplicadas na cópia local. A 0014 depende da 0013 e das funções de papéis existentes no Cloud.

Sessões antigas recebem uma fotografia feita na data da migração: a composição histórica anterior não pode ser reconstruída. Novas sessões congelam os dados desde sua abertura. A autoria histórica é preenchida onde existe perfil correspondente. Antes/depois antigo só aparece quando o registro original continha esses dados.

Confirmar em homologação: SSO, quatro papéis/RLS reais, Storage, duas sessões simultâneas, câmera física, compensação Auth sob falha e contrato de idempotência/preferências do agente externo. Os testes locais usam funções auxiliares de autenticação e permissões de teste; não certificam as políticas reais do Cloud. O remetente do webhook continua autenticado pela chave compartilhada e a nova função é executável apenas pelo serviço.

Se um envio ficar sem confirmação, consultar o provedor e conciliar o envelope na tela de Termos antes de qualquer nova solicitação. A aplicação não presume que falha de rede significa que o envelope não foi criado. Falha entre upload e gravação pode deixar o arquivo aguardando a repetição do mesmo anexo, que reutiliza o caminho por hash.

As alterações permanecem no diretório local, sem commit, push ou publicação.
