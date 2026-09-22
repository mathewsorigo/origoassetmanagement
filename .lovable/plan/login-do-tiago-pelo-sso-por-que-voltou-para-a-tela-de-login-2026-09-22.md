# Login do Tiago pelo SSO: por que voltou para a tela de login

## O que os dados mostram

- O e-mail `tiago.cunha@origoenergia.com.br` foi liberado na lista de acessos às **20:12**.
- A tentativa de login dele aconteceu **antes disso** (por volta das 20:10).
- Não existe nenhuma conta criada para esse e-mail no sistema — ou seja, a autenticação na Microsoft funcionou, mas o sistema recusou a criação do acesso porque, naquele momento, o e-mail ainda não constava na lista de liberados.
- Quando isso acontece, hoje a pessoa simplesmente volta para a tela de login, **sem nenhuma mensagem explicando o motivo**. Foi exatamente o que ele viu.

Conclusão: não é falha do SSO nem das permissões que ele aceitou. Era só falta da liberação, que já existe agora.

## Primeiro passo (sem mexer em nada)

Pedir ao Tiago para tentar entrar novamente pelo botão "Entrar com Microsoft". Com a liberação já cadastrada, o acesso deve ser criado com os papéis definidos (admin, gestor, TI). Eu confirmo depois, pelos registros, se a conta foi criada.

## Melhoria que vou implementar

Para que ninguém mais fique sem entender o que aconteceu:

1. **Mensagem clara na tela de login** quando o acesso é recusado — em vez de voltar em silêncio, mostrar um aviso como:
   "Seu e-mail ainda não foi liberado para acessar o sistema. Fale com um administrador."
   E outro aviso específico para e-mails fora de @origoenergia.com.br.
2. **Registro dessas tentativas recusadas**, para o administrador ver em Acessos quem tentou entrar e não conseguiu, com um botão para liberar na hora.
3. **Aviso no cadastro de liberação** informando que a pessoa só entra após ser liberada, evitando o mesmo mal-entendido.

## Detalhes técnicos

- A recusa vem do gatilho `handle_new_user`, que lança exceção quando o e-mail não está em `access_allowlist`. O erro volta ao fluxo OAuth como parâmetro de erro na URL de retorno, hoje ignorado pela tela de login.
- Em `src/components/auth-screen.tsx`: ler `error`, `error_code` e `error_description` tanto da query string quanto do hash na montagem, traduzir para português e exibir num bloco de alerta fixo (além do toast), limpando a URL depois.
- Nova tabela `public.access_denied_attempts` (email, motivo, tentado_em) preenchida pelo próprio gatilho antes de lançar a exceção — a inserção precisa ser feita de forma que sobreviva ao rollback da transação (função auxiliar `security definer` com `pg_notify` não serve; usar uma tabela `UNLOGGED` não resolve o rollback, então o registro será gravado por uma função separada chamada via `dblink`-free alternativa: gravar na tabela e só então lançar a exceção não persiste, portanto o registro será feito pelo lado do app ao detectar o erro de retorno do OAuth, via server function pública com validação do formato do e-mail).
- Em `/administracao`: novo bloco "Tentativas recusadas" listando os registros com ação "Liberar este e-mail" (reaproveita `addAllowedEmail`) e opção de descartar.
- Grants e RLS: leitura/escrita da nova tabela restritas a admin; inserção feita por server function com `service_role`.
