# Tela de login em duas colunas

## Objetivo
Dividir a tela de login em duas partes: à **direita**, fundo branco com o logotipo e os campos de login; à **esquerda**, fundo escuro (dark) com uma frase que resume o sistema.

## Mudanças

### `src/components/auth-screen.tsx`
- Reescrever `AuthBackdrop` para um layout de duas colunas em tela cheia:
  - **Coluna esquerda (dark):** fundo grafite/turquesa escuro (reaproveita o `.dark` e os brilhos difusos já existentes), com uma frase de destaque que resume o sistema, por exemplo: *"Gestão completa dos ativos de TI da Órigo — do vínculo à assinatura digital."* + um subtítulo curto. Tipografia grande, sem caixa.
  - **Coluna direita (branca):** fundo branco, centraliza o logotipo da Órigo no topo e abaixo o cartão de login (e-mail, senha, Microsoft, esqueci minha senha, Entrar). Mantém toda a lógica atual de login intacta.
- Em telas pequenas (mobile), a coluna esquerda some e só a coluna de login aparece (classe `hidden md:flex`).
- Manter `OrigoLogo`, botão Microsoft, fluxo `handleLogin`/`handleReset`/`handleMicrosoft` e redirecionamento para `/painel` sem alterações.

### `src/routes/definir-senha.tsx`
- Como reutiliza `AuthBackdrop`, a tela de definir senha herda o mesmo layout de duas colunas sem código extra.

## Sem alterações
- Sem mudanças de banco, permissões, regras de negócio ou integrações.
- Lógica de autenticação e fluxo de navegação permanecem iguais.

## Verificação
- Typecheck (`bunx tsgo --noEmit`).
- Playwright em `/auth` e `/definir-senha` para confirmar layout em duas colunas, sem erros de console e responsivo.
