# Tela de login escura e moderna (padrão 2026)

## Objetivo
Refazer o visual da tela de login (que também é a primeira tela do sistema) deixando-a escura, moderna e minimalista, mantendo o logotipo da Órigo em destaque e todo o comportamento atual (e-mail/senha, Microsoft, "Esqueci minha senha").

## O que muda

1. **Fundo escuro com identidade Órigo**
   - Fundo grafite profundo (quase preto, puxando para o tom do menu lateral) em toda a tela.
   - Efeito sutil de brilho turquesa (e um toque de roxo) atrás do cartão — como uma luz difusa, sem gradientes chamativos.
   - Textura de malha/pontos quase imperceptível para dar profundidade.

2. **Logotipo mantido e em destaque**
   - O símbolo turquesa da Órigo continua como peça central, maior, com leve brilho ao redor.
   - Se o logotipo completo (com nome) não tiver contraste no fundo escuro, uso o símbolo + nome "Órigo Ativos" em texto claro ao lado/abaixo, mantendo a marca idêntica.

3. **Cartão de vidro escuro**
   - Cartão em vidro fosco escuro (fundo translúcido com desfoque), borda fina clara, cantos suaves.
   - Título "Acessar o sistema" e subtítulo em tons claros.
   - Campos de e-mail e senha em cinza-escuro com foco em turquesa brilhante.
   - Botão "Entrar" turquesa sólido com sombra luminosa sutil.
   - Botão "Entrar com Microsoft" em versão escura (borda clara, ícone colorido).
   - "Esqueci minha senha" em turquesa claro.

4. **Movimento suave**
   - Entrada com fade/slide escalonado (logo → cartão → campos).
   - Transição delicada de foco nos campos e no botão.

5. **Mesma cara nas telas irmãs**
   - A tela "Definir senha" (/definir-senha) recebe o mesmo fundo escuro e cartão de vidro, para a experiência ser contínua (convite, redefinição e login com a mesma identidade).

## O que NÃO muda
- Nenhuma funcionalidade: login por e-mail/senha, Microsoft, redefinição de senha e redirecionamento para o Painel seguem iguais.
- A parte interna do sistema (menu, listas, painel) continua clara como está — o escuro é só da entrada.
- Nenhuma mudança de banco de dados ou permissões.

## Detalhes técnicos
- Reescrita do `src/components/auth-screen.tsx` (usado por / e /auth) com classes utilitárias escuras locais (sem alterar os tokens claros do sistema interno).
- Mesmo tratamento visual em `src/routes/definir-senha.tsx`.
- Uso de `OrigoSimbolo`/`OrigoLogo` conforme contraste sobre o fundo escuro; sombras e brilhos via tokens/oklch já existentes.
- Verificação: typecheck + captura de tela da nova tela no navegador.
