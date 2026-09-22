# Painel no lado direito + editar e excluir rápido

## O que muda

### 1. Painel abre à direita, no formato da referência
Ao clicar num equipamento, o painel passa a abrir do lado **direito** da tela (hoje abre à esquerda), mais largo, e com a mesma organização da imagem enviada:

```text
┌──────────────────────────────┬──────────────────────────────────────┐
│  ▢ ícone grande              │ Detalhes  Uso  Documentos            │
│  Acer Nitro                  │ ──────────────────────────────────── │
│  Série fdsfsfsdf             │  Hardware                            │
│                              │  Tipo        Notebook                │
│  • Disponível                │  Marca       Acer                    │
│  • Notebook · Simpress       │  Modelo      Nitro                   │
│                              │  Condição    —                       │
│  Ações                       │                                      │
│  [Vincular a uma pessoa]     │  Identificação                       │
│  [Registrar devolução]       │  Série / Patrimônio / IMEI           │
│  [Enviar termo]              │                                      │
│  [Marcar em manutenção]      │  Contrato                            │
│                              │  Fornecedor / Contrato / Custo /     │
│  [Editar]  [Excluir]         │  Início e fim da locação             │
│  Abrir ficha completa        │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

- Coluna esquerda fixa dentro do painel: ícone do tipo, nome, série, selos de situação/tipo/fornecedor/Intune, ações rápidas e navegação para o item anterior/seguinte.
- Área principal em abas: **Detalhes** (blocos Hardware, Identificação, Contrato e Gestão em pares rótulo/valor, como na referência), **Uso** (usuário atual e histórico) e **Documentos**.
- Por padrão os dados aparecem em leitura (mais limpo, igual à referência). O botão **Editar** troca os blocos por campos preenchíveis com Salvar/Cancelar no pé do painel. Quem não tem permissão não vê Editar nem Excluir.

### 2. Excluir e editar rápido
- **Na lista:** cada linha ganha um botão de três pontos ao final, com **Editar** (abre o painel já em modo edição) e **Excluir** (pede confirmação).
- **No painel:** botões Editar e Excluir na coluna lateral.
- A exclusão pede confirmação mostrando marca, modelo e série. Se o equipamento tiver vínculo ativo, a exclusão é recusada com a orientação de registrar a devolução primeiro; se tiver histórico e termos, o aviso explica que esses registros também serão apagados antes de confirmar. Toda exclusão fica registrada na auditoria.
- Mesmo padrão aplicado à tela de Colaboradores (painel à direita, editar e excluir rápido).

## Detalhes técnicos

- `asset-detail-panel.tsx`: `Sheet side="right"`, largura ~`sm:max-w-[820px]`, layout `grid` de duas colunas (empilha no mobile), rodapé fixo apenas no modo edição. Novo estado `mode: "view" | "edit"` e prop `initialMode` para o atalho Editar da lista.
- Bloco de leitura com um componente interno `Field({label, value})` reutilizado nos grids.
- Exclusão: verificação de `assignments` com `status = 'ativo'` antes de apagar; delete em `agreements`/`documents`/`assignments` do ativo e depois em `assets`, via Supabase, com `logAudit({action:"excluir"})` e invalidação de `["assets"]`. Confirmação em `AlertDialog`.
- Menu da linha com `DropdownMenu` (shadcn), com `stopPropagation` para não abrir o painel ao clicar no menu.
- `employee-detail-panel.tsx` e `pessoas.index.tsx` recebem as mesmas mudanças.
- Sem alteração de banco, RLS ou permissões: exclusão continua restrita a quem já tem permissão de operação.
