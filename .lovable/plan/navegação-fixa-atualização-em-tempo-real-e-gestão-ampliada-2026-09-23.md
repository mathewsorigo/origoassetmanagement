# Navegação fixa, atualização em tempo real e gestão ampliada

## 1. Barra lateral e topo sempre visíveis
- Transformar a área autenticada em uma estrutura de altura fixa: barra lateral e cabeçalho permanecem visíveis, enquanto somente o conteúdo central rola.
- Preservar o menu recolhível no celular e revisar páginas longas, tabelas, painéis laterais e diálogos para evitar rolagem duplicada ou conteúdo encoberto.

## 2. Inclusão, edição e remoção nos módulos aplicáveis
- Revisar os módulos de gestão e padronizar ações conforme as permissões atuais: ativos, colaboradores, contratos, vínculos, inventários, termos, documentos, etiquetas, localidades, fornecedores, departamentos e modelos de termo.
- Manter Auditoria e histórico de importações somente leitura, pois são registros de rastreabilidade; integrações continuam com ações próprias de configurar, testar e sincronizar.
- Em Contratos, adicionar criar, editar e remover usando os dados já armazenados nos equipamentos: número, fornecedor, início, fim e custo. A edição será aplicada de forma consistente aos itens vinculados; a remoção desvincula os dados contratuais dos equipamentos, sem excluir os ativos.
- Reutilizar os padrões existentes de painel lateral, confirmação, permissões e registro de auditoria.

## 3. Atualização automática sem piscar
- Corrigir a integração entre navegação e cache para que a camada de dados seja a responsável pela atualização e pré-carregamentos não mantenham informações antigas.
- Criar uma assinatura central de mudanças nas tabelas usadas pelas páginas e atualizar somente as consultas afetadas quando houver alteração feita pelo sistema, pelo Hermes ou pelas integrações.
- Manter os dados atuais na tela durante a atualização em segundo plano, exibindo carregamento completo apenas no primeiro acesso; revalidar também ao voltar para a aba como proteção contra perda temporária da conexão.
- Após cada gravação, atualizar imediatamente a interface e sincronizar em segundo plano, evitando recarregar a página inteira.

## 4. Novos dados de presença do ativo
- Manter `intune_last_sync` como a fonte de “Último check-in no Intune”, conforme definido.
- Adicionar ao ativo um campo próprio de texto para “Última localidade vista”, preenchido pela integração Intune/Hermes, sem coordenadas.
- Exibir ambos na lista, nos cartões, no painel lateral e na ficha completa; permitir selecionar essas colunas e pesquisar/filtrar quando aplicável.
- Incluir os campos nos contratos da API Hermes, importação/exportação e trilha de auditoria, sem confundir a última localidade detectada com a localidade administrativa já existente.

## 5. Indicador Bitdefender
- Adicionar ao ativo o estado de instalação do Bitdefender, atualizado pelo sincronismo e também visível/editável para perfis autorizados.
- Usar o símbolo oficial do Bitdefender como recurso local, com alternativa textual acessível: cinza quando não instalado e vermelho quando instalado.
- Mostrar o indicador na tabela/cartões de ativos, no painel lateral e na ficha completa, com dica ao passar o mouse e rótulo acessível.
- Expor o campo na API Hermes para leitura e atualização durante o sincronismo.

## 6. Dados, segurança e validação
- Criar uma migração para `last_seen_location` e `bitdefender_installed`, atualizar os tipos gerados e manter as políticas atuais de leitura/escrita dos ativos.
- Registrar mudanças manuais e vindas da integração na auditoria, incluindo valores anterior e posterior.
- Verificar permissões por perfil, atualização simultânea em duas sessões, navegação fixa e apresentação em desktop e celular.

## Detalhes técnicos
- O cabeçalho já usa comportamento fixo durante rolagem, mas a barra lateral volta a ser estática no desktop; o contêiner autenticado será ajustado para rolagem interna consistente.
- Atualmente as consultas mantêm dados frescos por cinco minutos, não revalidam ao voltar à aba e não há assinatura em tempo real. Será criado um sincronizador central de eventos com invalidação dirigida das chaves do TanStack Query e atualização sem estado vazio intermediário.
- Contratos ainda não possuem tabela própria: são agrupados pelos campos `contract_number`, `supplier`, `lease_start`, `lease_end` e `monthly_cost` dos ativos. A gestão seguirá esse modelo para não quebrar importações nem a API existente.
- O banco já possui `intune_last_sync`; não será criado um campo duplicado para “última atividade”.
