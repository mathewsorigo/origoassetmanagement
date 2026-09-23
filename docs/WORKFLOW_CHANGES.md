# Alterações de fluxo e preparação para publicação

As alterações são locais. A migração `drizzle/migrations/0013_consistent_asset_workflows.sql`
foi aplicada somente às bases locais `origo_preview` e `origo_workflow_test`.

## Ordem de implantação

Aplicar a migração 0013 no Lovable Cloud antes de publicar o frontend correspondente,
usando o processo de migrações do projeto. Ela adiciona `archived_at`, três views com
`security_invoker`, três funções transacionais e um índice que impede dois vínculos
ativos para o mesmo ativo. Também retira a permissão de exclusão direta de ativos e
pessoas do papel `authenticated`. As políticas RLS existentes continuam valendo.

Antes da migração, verificar duplicidades na base atual:

```sql
SELECT asset_id, count(*) FROM public.assignments
WHERE status = 'ativo' GROUP BY asset_id HAVING count(*) > 1;
```

O backup local não tinha duplicidades. Se a base atual tiver, a criação do índice
falhará; resolver os vínculos conflitantes antes de prosseguir. Executar a migração
em uma transação para evitar aplicação parcial.

## Comportamento

- Entrega e devolução, inclusive na ficha do ativo, usam uma transação para vínculo,
  situação do ativo, termo/checklist e auditoria. Entrega exige modelo de termo padrão.
- Arquivar preserva registros relacionados e permite restauração; vínculos ativos
  impedem arquivamento. Listas operacionais de Ativos/Pessoas ocultam arquivados.
- As três listas principais paginam, buscam e ordenam no servidor. Exportações
  percorrem todas as páginas correspondentes aos filtros.
- Datas sem horário mantêm o dia informado. Timestamps continuam no horário local.
- Os cartões do painel aplicam filtros; a tabela tem cabeçalho fixo e colunas
  opcionais menos usadas começam ocultas, respeitando preferências já salvas.

## Validação local

`scripts/test-workflows.mjs` usa exclusivamente `origo_workflow_test`, uma base
descartável restaurada do backup, com a migração aplicada. O script confere o nome
da base antes de gravar. Testa autorização, rollback, concorrência, devolução,
arquivamento em lote, restauração e preservação do histórico. Não reproduz todas as
políticas RLS/Storage do ambiente Cloud; o teste autenticado em homologação continua
necessário antes da publicação.

A demonstração do navegador permanece somente leitura. A restauração local não
contém arquivos do Storage. Uploads precedem a transação SQL; uma falha de rede
ambígua após o upload pode deixar arquivos órfãos, sem registro de sucesso falso.

Marca, nomes, pendências do painel e apresentação do Bitdefender não foram alterados.
