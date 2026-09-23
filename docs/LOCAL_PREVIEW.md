# Prévia com cópia local do banco

O backup de 23/09/2026 foi restaurado em uma instância PostgreSQL local,
fora do repositório, em `%LOCALAPPDATA%\origoassetmanagement-local`.
Foram conferidas 27 tabelas e 11.788 registros contra o backup, incluindo
1.076 ativos, 354 pessoas e 365 vínculos.

## Executar nesta máquina

1. Execute `powershell -File scripts/start-local-data.ps1` e mantenha o terminal aberto.
2. Execute `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort`
   em outro terminal, se o frontend ainda não estiver rodando.
3. Abra `http://127.0.0.1:5173` e escolha **Entrar na demonstração local**.

As flags abaixo ficam em `.env.local`, ignorado pelo Git:

```dotenv
VITE_LOCAL_PREVIEW=true
VITE_LOCAL_PREVIEW_DATA=true
```

Sem a segunda flag, a demonstração exibe listas vazias. O modo de demonstração
exige desenvolvimento, ativação explícita e hostname de loopback; não é habilitado
em builds de produção.

## Funcionamento e limites

- PostgreSQL escuta somente em `127.0.0.1:54330`; PostgREST em `127.0.0.1:54331`.
- O Vite encaminha `/__local-data/` para essa API apenas no servidor de desenvolvimento
  com as flags habilitadas. Credenciais da nuvem não são encaminhadas.
- A API usa um papel com permissão de consulta e transações somente leitura.
  A aplicação também rejeita gravações e RPCs no modo de demonstração.
- Foi restaurado o conteúdo das tabelas de `public`, tipos, índices e relações.
  Triggers, políticas, funções de integração, contas e sessões do serviço de autenticação
  não foram ativados. Uma função local `auth.uid()` retorna NULL apenas para suportar
  o default de uma coluna; ela não autentica ninguém.
- O login de demonstração continua sendo uma identidade visual local. Recursos que
  dependem das funções autenticadas do servidor (por exemplo, administração de acessos)
  e integrações externas não são reproduzidos por essa cópia.
- Anexos do Storage não estão nesse backup. Os registros são uma fotografia do momento
  da exportação, sem sincronização automática com Lovable Cloud.
- Backup, arquivos do banco, logs e senhas locais ficam fora do Git. Não copiar esses
  arquivos para `public/`, para `src/` ou para commits.

Os executáveis portáteis estão em `%LOCALAPPDATA%\codex-tools\origo-db` (PostgreSQL)
e `%LOCALAPPDATA%\codex-tools\origo-api` (PostgREST). A instalação local não configura
serviços do Windows nem inicialização automática.

A migração 0013 também está aplicada nesta cópia: adiciona três views de consulta
e os novos fluxos, sem liberar gravações à demonstração. Detalhes de validação e
implantação estão em [WORKFLOW_CHANGES.md](WORKFLOW_CHANGES.md).
