# Evolução do sistema: contratos Simpress, automação de termos e inventário físico

## 1. Gestão de contratos e locações Simpress

Hoje cada equipamento tem apenas datas de início e fim da locação. Vamos criar uma visão de contratos:

- **Aba "Contratos"** (nova área no menu): lista de locações com fornecedor, quantidade de equipamentos, início, fim, dias restantes e situação calculada (vigente, vencendo em 30 dias, vencida).
- **Alertas automáticos**: no Painel, bloco "Locações vencendo" ganha destaque com contagem regressiva; na lista de Contratos, filtro rápido por "vencem em 30/60/90 dias".
- **Ações em massa por contrato**: selecionar todos os equipamentos de uma locação e gerar lista de devolução (imprimível/CSV) para enviar à Simpress ao fim do contrato.
- **Campo novo em equipamentos**: número do contrato/pedido Simpress, para agrupar a locação corretamente.

## 2. Automação de termos de responsabilidade

- **Fila de envio**: ao vincular equipamento, o termo entra em uma fila visível em Termos com situação (aguardando envio, enviado, assinado, expirado) — hoje o envio é manual.
- **Cobrança de pendentes**: botão "Cobrar pendentes" em Termos que reenvia o lembrete a todos com termo pendente além do prazo configurado em Configurações (usa o texto e o prazo já existentes nas Preferências de termos); registro de cada cobrança na auditoria e na linha do tempo do equipamento/pessoa.
- **Relatório de adimplência**: no Painel e em Termos, percentual de termos assinados, pendentes e vencidos por departamento/localidade, com lista dos maiores devedores de assinatura.
- **Envio por e-mail**: os lembretes por e-mail dependem de configurar um domínio de envio da Órigo (ex.: avisos@origoenergia.com); enquanto isso não é feito, as cobranças ficam registradas no sistema e o envio ao Docusign continua pelo hermes-agent. Se quiser ativar os e-mails, configuramos o domínio de envio em seguida.

## 3. Inventário físico (auditoria com QR Code)

- **Sessão de conferência**: nova área "Inventário" para iniciar uma conferência (ex.: "Sede SP — setembro/2026"), escolhendo o universo (tudo, por localidade, por tipo).
- **Leitura por câmera**: tela de conferência que abre a câmera do celular, lê o QR Code do equipamento (o QR já gerado na ficha) e marca como "conferido", mostrando na hora o que foi encontrado e o que diverge.
- **Sem câmera**: digitação do número de série também marca a conferência.
- **Resultado**: ao encerrar, relatório com conferidos, não encontrados (candidatos a extraviado), encontrados fora da lista e divergências de responsável/localidade; opção de marcar em massa como "extraviado" com registro na auditoria.
- **Checklist de entrega/devolução**: no popup do equipamento, ao vincular ou devolver, checklist de condição (liga, tela, teclado, carregador, acessórios) com fotos opcionais, gravado no histórico do vínculo.

## Observações

- Nada disso depende das credenciais pendentes (hermes-agent, Intune, Simpress, Easy): tudo funciona com os dados já existentes no sistema.
- Permissões: gestão de contratos e inventário visíveis a administradores e TI; conferência por QR também pode ser feita por gestores.

## Detalhes técnicos

- Migração nova: `assets.contract_number`; tabelas `inventory_sessions` (id, name, scope jsonb, status aberta/encerrada, created_by, timestamps), `inventory_checks` (session_id, asset_id, checked_at, checked_by, divergencia), `assignment_checklists` (assignment_id, kind entrega/devolucao, items jsonb, photos text[], created_by); GRANTs authenticated/service_role e RLS por papel (escrita: is_operator; conferência: is_manager).
- Funções de servidor novas: cobrança de pendentes (le app_settings "termos"), encerramento de sessão de inventário com baixa em massa, e lista de devolução por contrato.
- Rotas novas: `/_authenticated/contratos.tsx` e `/_authenticated/inventario.tsx` (+ sub-rota de conferência `inventario.$sessionId.tsx` com leitor de QR via biblioteca `html5-qrcode` carregada sob demanda).
- Termos: colunas de situação de envio e ação em massa "Cobrar pendentes"; Painel ganha bloco de adimplência.
- Verificação: typecheck + teste no navegador das telas novas (lista de contratos, sessão de inventário com conferência digitada, cobrança de pendentes e checklist no vínculo).
