# Configurações, gestão de acessos e navegação mais rápida

## 1. Criação de acessos pelo administrador

Na tela **Administração > Acessos** entra o botão **Convidar pessoa**, com nome, e-mail e os papéis (Administrador, TI, Gestor, Colaborador).

- A pessoa recebe um e-mail de convite e define a própria senha ao clicar no link.
- A lista de acessos passa a mostrar situação de cada um: **Ativo**, **Convite pendente** ou **Desativado**, com a data do convite e do último acesso.
- Ações por linha: reenviar convite, alterar papéis, desativar/reativar o acesso e cancelar um convite que ainda não foi aceito.
- Nenhum administrador consegue remover o próprio papel de administrador nem desativar a própria conta (evita ficar sem ninguém no comando).
- Toda concessão, remoção e convite fica registrada na Auditoria.

## 2. Fim do cadastro por conta própria

- A aba **Primeiro acesso** sai da tela de login: só o administrador cria acessos.
- O autocadastro é bloqueado também no servidor, para que ninguém crie conta por fora da tela.
- Login por e-mail/senha e pela conta Microsoft continuam como estão.

## 3. Senhas

- Na tela de login, **Esqueci minha senha** envia o link por e-mail (já existe, ganha confirmação visual clara).
- A tela de **definir senha** passa a atender três casos com a mesma aparência: convite aceito, redefinição por link e primeira senha. Valida força mínima, confirmação da senha e mostra erro amigável quando o link expirou, com botão para pedir um novo.
- Em **Configurações > Minha conta**, quem já está dentro troca a própria senha informando a senha atual.

## 4. Nova área de Configurações

Novo item no menu lateral, com três abas:

**Minha conta** — nome, telefone, cargo, e-mail (somente leitura), papéis atribuídos e troca de senha.

**Listas do sistema** — cadastro de Localidades, Departamentos, Fornecedores e Etiquetas (criar, renomear, escolher cor nas etiquetas, excluir quando não estiver em uso). Esses valores passam a alimentar os campos de seleção nas telas de equipamentos, pessoas e vínculos, no lugar de texto livre.

**Preferências de termos** — modelo do termo (o editor que hoje vive em Administração migra para cá), prazo padrão para assinatura, texto do e-mail de envio e aviso automático de termo pendente.

Administração fica só com acessos e papéis; o restante da configuração vive em Configurações. Quem não é administrador vê apenas "Minha conta".

## 5. Transição entre telas mais rápida

Hoje cada troca de tela remonta tudo e refaz as consultas do zero, por isso a sensação de travamento. Correções:

- Os dados já carregados ficam em memória por alguns minutos: voltar a uma tela é instantâneo, e a atualização acontece em segundo plano.
- O conteúdo antigo continua visível enquanto o novo chega, em vez de piscar para vazio.
- Ao passar o mouse sobre um item do menu, a próxima tela começa a carregar antes do clique.
- A animação de entrada deixa de remontar a tela inteira; fica um esmaecimento curto sem reposicionar o conteúdo.
- Gráficos, geração de planilha e de QR Code passam a carregar só quando usados, deixando o primeiro carregamento bem mais leve.
- Cada tela mostra esqueleto de carregamento no lugar de tela branca, e os contadores do topo deixam de recarregar a cada navegação.

## Detalhes técnicos

- Nova função de servidor `src/lib/admin-users.functions.ts` com `inviteUser`, `resendInvite`, `setUserRoles`, `setUserActive` e `revokeInvite`; cada uma valida `has_role(auth.uid(),'admin')` via `context.supabase` antes de carregar `supabaseAdmin` dentro do handler (`auth.admin.inviteUserByEmail` com `redirectTo` para a tela de definir senha).
- `supabase--configure_auth` com `disable_signup: true` e `require_current_password: true`.
- Migração nova: `profiles` ganha `status` (`ativo`/`convidado`/`desativado`), `phone`, `job_title`, `invited_at`, `last_sign_in_at`; tabelas `locations`, `departments`, `vendors` (nome único, ativo) e `app_settings` (chave/valor JSON, linha única de preferências de termos) — todas com `GRANT` para `authenticated`/`service_role`, RLS ligada, leitura para quem tem papel e escrita restrita a `is_operator`/`has_role('admin')`.
- Rotas novas: `src/routes/_authenticated/configuracoes.tsx` (abas) e `src/routes/definir-senha.tsx` (pública, substitui/absorve `reset-password.tsx` mantendo redirecionamento do caminho antigo). `auth-screen.tsx` perde a aba de cadastro.
- Performance: `getRouter` passa a criar o `QueryClient` com `staleTime: 5 * 60 * 1000`, `gcTime: 30 * 60 * 1000`, `refetchOnWindowFocus: false`; `defaultPreload: "intent"` e `defaultPreloadStaleTime: 30_000`; remoção do `key={pathname}` no `<main>` de `_authenticated.tsx`; `placeholderData: keepPreviousData` nas listas paginadas; `React.lazy` para os gráficos do painel e `await import()` para `xlsx` e `qrcode`; consultas de papéis/perfil/contadores com `staleTime` longo.
- Sem alteração nas regras de permissão existentes das telas de ativos, pessoas, vínculos e termos.
