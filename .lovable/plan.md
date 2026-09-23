# Substituir “Termos pendentes” por mapa de equipamentos

## Resultado
- Remover do painel o bloco **Termos pendentes** mostrado na referência.
- Inserir no mesmo espaço um mapa-múndi plano, alinhado ao visual atual do sistema.
- Exibir marcadores proporcionais à quantidade de equipamentos em cada localidade.
- Ao passar sobre ou selecionar um marcador, mostrar a localidade e o total de equipamentos.
- Incluir uma legenda compacta e a quantidade de equipamentos sem localização identificável.

## Dados utilizados
- Priorizar **Última localidade vista**.
- Quando ela estiver vazia, usar a **Localidade cadastrada**.
- Agrupar nomes equivalentes após normalização de maiúsculas, espaços e acentos.
- O mapa será atualizado automaticamente pelo mecanismo em tempo real já usado no painel.

## Comportamento sem dados
- Atualmente, os 1.076 equipamentos não possuem nenhuma das duas localidades preenchida.
- Enquanto não houver locais disponíveis, o mapa continuará visível em estado neutro e informará que os equipamentos estão sem localização, em vez de deixar um grande espaço vazio.

## Detalhes técnicos
- Criar um componente de mapa vetorial leve, carregado sob demanda para não aumentar o tempo inicial do painel.
- Adicionar a biblioteca de mapa necessária e manter as cores nos padrões visuais existentes.
- Ampliar a consulta do painel para incluir `last_seen_location` e `location`, sem criar novos dados ou alterar o cadastro dos ativos.
- Manter o bloco “Últimos vínculos” ao lado do novo mapa e preservar o restante do painel.
- Validar o resultado em telas grandes e pequenas, incluindo estado vazio, marcadores, tooltip e atualização dos totais.
