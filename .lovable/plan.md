# Gestão de Ativos — Órigo Energia

Sistema interno para controlar notebooks e celulares alugados da Simpress, vincular cada equipamento a um colaborador e gerar o termo de uso assinado digitalmente.

## Identidade visual

Baseada no site da Órigo Energia: verde solar como cor principal, azul-escuro/grafite para textos e áreas de apoio, fundos claros, cantos arredondados e tipografia moderna sem serifa. Interface em português, clara e densa em informação (tabelas, filtros, status coloridos).

## Telas e funcionalidades

**Entrada**
- Login por e-mail e senha e também "Entrar com Microsoft".
- Sem cadastro público: apenas administradores criam contas e definem o papel (administrador, TI, gestor, colaborador).
- Recuperação de senha por e-mail.

**Painel inicial**
- Totais de equipamentos por status (em uso, disponível, manutenção, devolvido à Simpress).
- Termos pendentes de assinatura, ativos sem responsável, contratos/locações a vencer.

**Ativos**
- Cadastro de notebooks e celulares: tipo, marca, modelo, número de série, patrimônio, IMEI, fornecedor (Simpress), início/fim da locação, custo mensal, condição, observações.
- Ficha do ativo com histórico completo: vínculos anteriores, termos assinados, movimentações.

**Pessoas**
- Cadastro de colaboradores: nome, e-mail corporativo, CPF, cargo, área, unidade, gestor, situação.
- Ficha da pessoa com equipamentos atuais, histórico e termos assinados.

**Vínculo (entrega/devolução)**
- Ao vincular um ativo a uma pessoa, o sistema gera automaticamente o termo de uso preenchido (dados da pessoa, do equipamento, data, condições) a partir de um modelo editável.
- O termo é enviado para assinatura eletrônica; o status aparece no sistema (rascunho, enviado, visualizado, assinado, recusado, expirado).
- Documento assinado fica anexado no histórico da pessoa e do equipamento, disponível para download.
- Devolução registra data, condição de retorno e encerra o vínculo.

**Importação em massa por planilha**
- Upload de Excel/CSV para ativos e para colaboradores.
- Modelo de planilha para baixar, pré-visualização linha a linha, validação com erros apontados e relatório do que foi criado/atualizado/ignorado.

**Integrações**
- Área de integrações com Intune, Simpress, Docusign e hermes-agent: status da conexão, última sincronização, registro de execuções e erros.
- Como o hermes-agent ainda não existe, o sistema já nasce com os pontos de conexão prontos: o fluxo completo (gerar termo, enviar para assinatura, receber o documento assinado, sincronizar inventário do Intune) funciona dentro do sistema e pode ser redirecionado ao hermes-agent informando a URL e a chave, sem refazer as telas.
- Enquanto a integração real não estiver ligada, o termo pode ser gerado e o documento assinado anexado manualmente, para o processo não parar.

**Administração e auditoria**
- Gestão de usuários e papéis, modelos de termo, listas de marcas/modelos/unidades.
- Trilha de auditoria: quem fez o quê e quando.
- Relatórios e exportação para Excel (inventário, ativos por área, termos pendentes, custos de locação).

## Detalhes técnicos

- Lovable Cloud para banco, autenticação (e-mail/senha + Microsoft) e armazenamento dos PDFs assinados.
- Papéis em tabela própria (`user_roles`) com função `has_role`, nunca no perfil; RLS em todas as tabelas: colaborador vê só o que é dele, TI/admin vê tudo.
- Tabelas principais: `profiles`, `user_roles`, `assets`, `assignments`, `agreements` (termos + status de assinatura), `documents`, `import_batches`, `import_rows`, `integration_settings`, `integration_runs`, `audit_log`.
- Camada de integração isolada em funções de servidor (`assinatura`, `intune`, `hermes`), com configuração por integração (URL base + chave guardada como segredo) e endpoint público de webhook, com verificação de assinatura, para receber o retorno "documento assinado".
- Importação de planilha processada no servidor, com validação por linha e idempotência por número de série / e-mail.

## Fora deste escopo agora

- Sincronização real com Intune, Docusign e Simpress só entra em produção quando as credenciais e o hermes-agent existirem; o plano entrega as telas, o fluxo e os pontos de conexão.
