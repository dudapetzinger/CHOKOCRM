# Funcionalidades

Este documento descreve o que o ChokoCRM faz, tela por tela, e as regras que valem em cada funcionalidade. Os números citados (prazos, limites, porcentagens) são os que estão no código.

## Sumário

1. [Perfis de uso](#1-perfis-de-uso)
2. [Acesso e senhas](#2-acesso-e-senhas)
3. [Carteira de clientes e cores](#3-carteira-de-clientes-e-cores)
4. [Ficha do cliente](#4-ficha-do-cliente)
5. [Check-in de visita](#5-check-in-de-visita)
6. [Agenda, calendário e roteiro](#6-agenda-calendário-e-roteiro)
7. [Compras, estoque e sugestões](#7-compras-estoque-e-sugestões)
8. [Mensagem pelo WhatsApp](#8-mensagem-pelo-whatsapp)
9. [Painel](#9-painel)
10. [Campanhas e metas](#10-campanhas-e-metas)
11. [Importação de notas fiscais](#11-importação-de-notas-fiscais)
12. [Usuários](#12-usuários)
13. [Modo demonstração](#13-modo-demonstração)
14. [Uso como aplicativo](#14-uso-como-aplicativo)
15. [O que o sistema não faz](#15-o-que-o-sistema-não-faz)

## 1. Perfis de uso

O sistema tem dois perfis: Representante e Gestor.

O representante cuida de uma carteira de clientes. Ele só vê e altera os clientes da própria carteira. É quem registra as visitas e fala com os clientes.

O gestor enxerga todas as carteiras. Nas telas de clientes, agenda e painel, um seletor permite ver a equipe inteira ou um representante por vez. É quem importa as notas fiscais, cria os clientes, as campanhas, as metas e os usuários.

O perfil Gestor é usado pela gestão da empresa, por meio de uma conta compartilhada chamada Gestão Chokolaten, com o usuário `gestao`. Neste documento, "o gestor" é quem está usando o sistema com esse perfil, e "a conta Gestão" é essa conta compartilhada.

| Ação | Representante | Gestor |
|------|:-------------:|:------:|
| Ver clientes, agenda e painel | Só a própria carteira | Todas as carteiras |
| Criar cliente, a partir de uma nota fiscal | Não | Sim |
| Editar dados e contatos do cliente | Sim | Sim |
| Inativar e reativar cliente | Não | Sim |
| Transferir clientes de carteira | Não | Sim |
| Registrar visita e enviar foto | Sim | Não |
| Corrigir a descrição e o resultado de uma visita | Só as próprias | Não |
| Alterar o intervalo entre visitas | Sim | Não |
| Marcar a data da próxima visita | Sim | Sim |
| Abrir a conversa com o cliente no WhatsApp | Sim | Sim |
| Concluir lembrete | Sim | Sim |
| Criar campanhas e metas | Não | Sim |
| Encerrar uma campanha em andamento | Não | Sim |
| Ver a análise de uma campanha encerrada | Sim, com os próprios números | Sim |
| Importar notas fiscais | Não | Sim |
| Gerenciar usuários | Não | Sim |

A tela inicial depende do perfil: o representante entra pela Agenda e o gestor entra pelo Painel.

## 2. Acesso e senhas

O acesso é feito com usuário e senha. O usuário é um nome curto, como `eduarda` ou `gestao`, definido pelo gestor ao criar a conta. O acesso vale por oito horas.

Qualquer pessoa pode trocar a própria senha no menu da conta, em Alterar senha, informando a senha atual.

Quem esquece a senha pede ao gestor, que define uma senha provisória na tela de Usuários. A pessoa entra com a senha provisória e depois a troca por uma só dela, no menu da conta, em Alterar senha. Não há recuperação de senha por e-mail.

Uma conta inativada pelo gestor não consegue mais entrar. Os clientes dela continuam na carteira até serem transferidos.

## 3. Carteira de clientes e cores

A tela Clientes lista a carteira com busca por nome ou por cidade (o campo "Nome ou cidade"), filtro por cidade e abas por situação. Cada cliente aparece com uma cor e uma frase curta que explica a cor, como "Atrasado · 42 dias sem visita".

### Como o cliente entra no sistema

O cliente é criado pela gestão, a partir de uma nota fiscal importada. O sistema lê na nota a razão social, o CNPJ, o endereço, a cidade e o telefone, e a gestão escolhe o representante que vai atender e pode ajustar o nome fantasia e o intervalo entre visitas. O representante não cadastra clientes. Ele completa os dados que a nota não traz, como os contatos.

O passo a passo está na seção [Importação de notas fiscais](#11-importação-de-notas-fiscais).

### Como a cor é definida

A cor depende de dois fatores: há quanto tempo o cliente foi visitado e se a última visita terminou em venda.

| Última visita | Cor |
|---------------|-----|
| Há até 15 dias, com venda | Verde |
| Há até 15 dias, sem venda | Amarelo |
| Entre 16 e 30 dias | Laranja |
| Há mais de 30 dias, ou nunca visitado | Vermelho |

Há um ajuste pela última compra. Se o cliente está verde ou amarelo, mas a última compra dele foi há mais de 60 dias, a cor passa a laranja. A visita está em dia, mas o cliente parou de comprar, e isso merece atenção.

A contagem é feita por dia do calendário, no horário de Brasília. Uma visita registrada ontem à noite conta como feita há um dia, mesmo que tenham passado poucas horas.

A cor nunca é gravada. Ela é calculada toda vez que a lista é aberta, então uma visita registrada agora muda a cor no mesmo instante.

### Abas

| Aba | O que mostra | Sentido |
|-----|--------------|---------|
| Prioridade | Clientes em vermelho e laranja | Quem precisa de visita primeiro |
| Atenção | Clientes em amarelo | Visitado há pouco, mas sem venda |
| Em dia | Clientes em verde | Visitado há pouco, com venda |
| Todos | A carteira inteira, com os inativos no fim | Consulta geral |

Dentro de cada aba, os clientes aparecem do mais urgente para o menos urgente.

Um botão de ajuda, na barra da lista, abre a legenda das situações, organizada pelas mesmas abas:

| Aba | Etiqueta | Regra |
|-----|----------|-------|
| Prioridade | Atrasado | Mais de 30 dias sem visita, ou nunca visitado |
| Prioridade | Vencendo | De 16 a 30 dias sem visita |
| Prioridade | Rebaixado | Visitado há até 15 dias, mas sem compra há mais de 60 dias |
| Atenção | Visitado sem venda | Visitado há até 15 dias, e a última visita não teve venda |
| Em dia | Em dia | Visitado há até 15 dias, e a última visita teve venda |

A legenda lembra ainda que a cor olha só a última visita e a última compra, que negociação conta como sem venda, que quem nunca comprou não é rebaixado e que o cliente inativo não tem cor.

### Mapa de clientes por cidade

A página de clientes traz o mapa da carteira, com o contorno de Santa Catarina e uma bolha por cidade. O tamanho da bolha é o número de clientes ativos da cidade e a cor é a situação mais urgente entre eles. Clicar em uma cidade abre, ao lado, os clientes dela, do mais urgente ao menos, com o link para a ficha de cada um. Para o gestor, o mapa segue o representante escolhido.

No computador, o mapa ocupa o espaço da ficha enquanto nenhum cliente está aberto. No celular, ele fica em um bloco acima das abas, que começa recolhido para a lista continuar à vista.

### Cliente inativo

Só a gestão inativa e reativa um cliente. O cliente inativo:

- aparece apenas na aba Todos, no fim da lista, com a etiqueta "Inativo";
- não tem cor, porque não está mais sendo visitado;
- sai da agenda, do roteiro e da contagem de clientes do painel (as visitas que ele já recebeu continuam contando no número de visitas e nas metas);
- não recebe novas visitas;
- mantém todo o histórico, que continua disponível na ficha.

## 4. Ficha do cliente

A ficha reúne tudo sobre o cliente em três abas.

A aba ERP e sugestões mostra a última compra, o volume de compras dos últimos 90 dias (com o período somado escrito ao lado, "de dd/mm a dd/mm"), o estoque estimado e as sugestões do que oferecer na época do ano. Para o cliente que tem nota fiscal importada, mostra também o bloco "Últimas vendas", com as cinco compras mais recentes; cada uma indica a origem: "NF" com o número da nota ou "Venda registrada na visita". Para o representante, com o cliente ativo, ela traz também o cartão Mensagem de estoque: o botão "Gerar mensagem" abre um texto sugerido que pode ser editado, a escolha do contato e o botão Abrir no WhatsApp. Nada do que é escrito ali fica guardado.

A aba Visitas mostra a última visita em destaque e as anteriores (três de início, com a opção de ver seis ou todas), com o resultado, a descrição e a foto de cada uma. Quando a visita tem produtos, vindos de uma nota fiscal vinculada ou dos dados de demonstração, aparecem também os produtos e o total ("Produtos · total"), com o botão "Ver produtos", e, quando há nota, o título "Produtos da NF" com o número dela.

A aba Cadastro mostra os dados do cliente e os contatos. Um dos contatos é o principal.

No alto da ficha ficam as ações do dia a dia: ligar para o cliente, abrir a conversa no WhatsApp, iniciar o check-in, adicionar um contato e ver ou alterar a data da próxima visita.

Para o gestor, o nome do representante no alto da ficha é um seletor: escolher outro representante transfere aquele cliente para a carteira dele.

### Recolher e expandir blocos

Os blocos maiores das telas têm, no título, um botão que recolhe e expande o conteúdo. O título continua visível com o bloco recolhido. A escolha fica guardada no navegador, por bloco, então a tela abre da mesma forma na próxima vez naquele aparelho.

| Tela | Blocos que recolhem |
|------|---------------------|
| Ficha do cliente | Insights e sugestões, Dados do ERP, Mensagem de estoque, Histórico de visitas e Recorrência de visitas |
| Clientes | Mapa de clientes por cidade, no celular (começa recolhido) |
| Painel | Metas, resultado das visitas, ritmo de visitas, ranking, clientes esfriando, datas comemorativas, estoque baixo e vendas por mês |
| Campanhas | Cada campanha, que recolhe a descrição, os produtos, os resultados e as metas dela |
| Importar notas | Importações anteriores |

Os quatro indicadores do alto do Painel ficam sempre abertos.

### Intervalo entre visitas

Cada cliente tem um intervalo previsto entre visitas, em dias. Na ficha, ele fica no bloco "Recorrência de visitas", na aba Visitas. O padrão é 15, e o valor aceito vai de 1 a 365. O representante pode alterar o intervalo, mas precisa escrever uma justificativa. A faixa sugerida é de 15 a 30 dias; fora dela, a tela avisa e pede confirmação. O intervalo só pode ser alterado em cliente ativo. Cada alteração fica registrada com data, autor, valor antigo, valor novo e motivo.

### Próxima visita

A data da próxima visita vem de uma destas fontes, nesta ordem:

1. a data marcada no check-in, pelo representante, ou na ficha, pelo representante ou pelo gestor;
2. a data da última visita mais o intervalo do cliente;
3. para quem nunca foi visitado, a data de criação do cliente mais o intervalo.

Uma data marcada vale até o cliente receber uma visita naquele dia ou depois. A partir daí ela é considerada cumprida e o cliente volta a seguir o intervalo. Cada novo check-in substitui a data marcada antes: o último passo já traz a data existente, e o representante pode mantê-la, trocá-la ou deixar o cliente sem data. Alterar o intervalo entre visitas também apaga a data marcada.

## 5. Check-in de visita

O check-in é o registro da visita, feito pelo representante, de preferência na hora. Ele tem quatro passos.

| Passo | O que é informado |
|-------|-------------------|
| A visita | Data e hora, pessoa atendida e, se houver, a campanha trabalhada |
| Resultado | Venda, negociação ou sem venda |
| O que aconteceu | Descrição da visita e foto |
| Próximos passos | Data da próxima visita, com a campanha dela se houver, e lembrete, todos opcionais |

Regras:

- A descrição é obrigatória e precisa ter pelo menos três caracteres.
- A data da visita não pode estar no futuro.
- A foto é obrigatória no aplicativo, uma por visita. O aplicativo reduz a imagem antes de enviar, de modo que a foto tirada no celular fica bem abaixo do limite de 5 MB do servidor. O campo da foto tem os textos do próprio sistema ("Anexar foto" e, sem foto escolhida, "Nenhuma foto selecionada"), e não os do navegador.
- A data da próxima visita, quando informada, precisa ser de hoje em diante.
- O lembrete tem um texto de até 200 caracteres e uma data, de hoje em diante.
- Não é possível registrar visita em cliente inativo nem vincular a visita a uma campanha encerrada.

### Venda e nota fiscal

No check-in, o representante informa apenas que houve venda. A tela não tem campo de produtos nem de valores.

Os produtos e o valor chegam depois, quando a gestão importa a nota fiscal daquela venda (nos dados de demonstração, já vêm gravados na visita). O sistema liga a nota à visita pela data, seguindo as regras da seção [Importação de notas fiscais](#11-importação-de-notas-fiscais). A partir daí, a visita passa a mostrar os produtos e o total da nota, e a venda entra nas metas, nas campanhas e no ranking. Se a visita tinha sido registrada como negociação ou sem venda, o resultado dela passa a ser Venda.

### Corrigir uma visita

Depois de registrada, a visita pode ser corrigida pelo representante que a fez. Pelo botão "Editar visita", ele pode alterar a descrição e o resultado. Há uma exceção: uma visita que já tem produtos ou uma nota fiscal vinculada continua como venda, e o sistema recusa a troca do resultado. Se a foto não foi enviada no check-in, ele pode anexá-la depois, na própria visita.

### Retenção das fotos

As fotos ficam guardadas por 90 dias. Depois disso, uma rotina diária as apaga, e a visita passa a mostrar "Foto removida após 90 dias". O restante do registro permanece.

### Lembretes

O lembrete é uma tarefa com data, ligada a um cliente. Ele aparece na agenda a partir do dia marcado, no calendário e na ficha, e continua aberto até o representante dono da carteira ou o gestor marcá-lo como concluído. Novas visitas não fecham lembretes antigos.

## 6. Agenda, calendário e roteiro

### Agenda do dia

A agenda organiza o trabalho do representante em quatro abas, cada uma com a contagem do que tem dentro:

| Aba | O que entra |
|-----|-------------|
| Hoje | Clientes com visita prevista para hoje, e o roteiro do dia |
| Atrasadas | Clientes cuja próxima visita já passou |
| Próximos 7 dias | Clientes com visita prevista para a semana seguinte |
| Lembretes | Lembretes abertos com data até hoje |

A agenda abre na aba Hoje. A contagem de Atrasadas aparece em tom de alerta sempre que há visita atrasada, para a prioridade ficar à vista com outra aba aberta. A aba escolhida fica no endereço da página (`?aba=atrasadas`, por exemplo). Cada aba vazia tem o próprio texto, como "Nenhuma visita atrasada.".

Nas atrasadas e nas de hoje, a ordem é pela cor, do vermelho ao verde, e depois pelos dias de atraso.

Todos os dias, às 6h, uma rotina do servidor registra em log quantas visitas atrasadas e previstas cada representante tem.

### Calendário

O calendário do mês mostra o que foi marcado. Caixas de seleção acima dele permitem escolher o que aparece:

| Caixa | O que mostra | Quem vê |
|-------|--------------|---------|
| Visitas | Visitas com data marcada | Representante e gestor |
| Lembretes | Lembretes abertos | Representante e gestor |
| Datas comemorativas | Páscoa, Dia das Mães e as outras datas do ano | Representante e gestor |
| Campanhas | Período de cada campanha | Gestor |

Na legenda e no detalhe de cada dia, as datas aparecem como "Data comemorativa" e as campanhas como "Campanha". Todas as caixas vêm marcadas. Desmarcar uma delas tira aquele tipo do calendário, para a pessoa ver, por exemplo, só os lembretes.

### Roteiro

O roteiro do dia fica na aba Hoje da agenda. Ele reúne até dez visitas de hoje, começa pela mais urgente e segue sempre para a cidade mais próxima da anterior. As visitas além da décima aparecem como fora do roteiro. O trajeto abre no Google Maps; com mais de cinco paradas, o roteiro é dividido em trechos, com um botão para cada trecho. As distâncias são estimativas, calculadas a partir das coordenadas dos municípios de Santa Catarina. Para o gestor, o roteiro aparece quando um representante está escolhido no seletor.

## 7. Compras, estoque e sugestões

### De onde vêm os dados de compra

As compras de cada cliente vêm de uma de duas fontes:

| Fonte | Quando vale |
|-------|-------------|
| Notas fiscais importadas pela gestão | Para o cliente que tem nota importada |
| Simulação | Para o cliente de demonstração, que não tem nota |

O sistema usa uma fonte por cliente e nunca soma as duas. Na simulação, os números são gerados a partir do código do cliente e são sempre os mesmos para o mesmo código.

A informação de estoque existe apenas na simulação, porque as notas fiscais não trazem o estoque do cliente.

### Sugestões por época do ano

O sistema conhece cinco datas comemorativas: Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais e Natal. As datas móveis são calculadas para cada ano. O período de vendas de cada data são os 30 dias anteriores a ela.

Para cada data que cai nos próximos 90 dias (o prazo pode ser trocado para 30, 60 ou 180 dias), a ficha compara o que o cliente comprou nesse mesmo período do ano anterior com a média de compras dele ao longo de um ano:

| Comparação com a média | Sugestão |
|------------------------|----------|
| Comprou pelo menos 20 % acima | Aumentar oferta |
| Comprou pelo menos 20 % abaixo | Ofertar desconto |
| Ficou perto da média | Manter a oferta |

A sugestão cita os três produtos que o cliente mais comprou naquele período. Se não há compras para comparar, a ficha avisa que falta histórico.

Cada sugestão mostra também as campanhas, promoções e eventos que têm algum dia dentro do período de vendas da data, desde que estejam em andamento ou programados. A que está em andamento aparece com o nome e, se houver, o desconto. A programada aparece com o nome e as datas. Campanha encerrada não aparece. O mesmo vale para a data sem histórico de compras.

## 8. Mensagem pelo WhatsApp

O botão WhatsApp, no alto da ficha, abre a conversa com o cliente. Para o representante, com o cliente ativo, a conversa abre já com uma mensagem escrita, perguntando como está o estoque. Nos 30 dias que antecedem uma data comemorativa, a mensagem cita os produtos indicados para ela. Para o gestor e para um cliente inativo, o link leva só o número, sem texto.

Se o cliente tem dois ou mais contatos com telefone válido, o botão mostra a lista para a pessoa escolher com quem quer falar. O contato principal aparece primeiro. Se há um contato só, a conversa abre direto. Quando nenhum telefone do cliente serve para o WhatsApp, o botão não aparece.

O envio acontece no WhatsApp, pelas mãos de quem está usando. A pessoa pode alterar o texto antes de enviar. Por isso o sistema não guarda registro dessas mensagens: ele não teria como saber o que foi realmente enviado.

## 9. Painel

O painel mostra os resultados de um período. O período pode ser este mês (do dia 1º até hoje), 30, 90 ou 365 dias, ou um intervalo de datas à escolha, de até 365 dias, no botão "Personalizado". O painel abre em "Este mês", que é o período da meta mensal: assim o número de visitas dos indicadores é o mesmo da meta. Em "Personalizado", os dois campos de data ficam em uma linha própria, abaixo dos botões de período. O representante vê os números da própria carteira. O gestor vê a equipe inteira ou um representante.

O painel tem duas abas. A primeira responde como andam as visitas e as vendas da carteira; a segunda, o que oferecer nas próximas datas comemorativas. Em telas largas os blocos de cada aba se dividem em duas colunas; no celular ficam um abaixo do outro.

### Metas e resultados

| Indicador | Como é calculado |
|-----------|------------------|
| Número de visitas | Total de visitas no período e média por cliente ativo |
| Clientes visitados | Parte dos clientes ativos que recebeu ao menos uma visita no período (cada cliente conta uma vez) |
| Conversão em vendas | Parte das visitas que terminou em venda |
| Clientes esfriando | Clientes em laranja ou vermelho hoje, sem depender do período |

Abaixo dos indicadores ficam as metas com o realizado (as metas comuns e as das campanhas em andamento), o resultado das visitas por representante, o ritmo de visitas ao longo do período (por semana em períodos de até 91 dias, por mês nos maiores), o bloco dos clientes esfriando (a distribuição da carteira por cor e os cinco clientes mais urgentes) e, para o gestor, o ranking dos representantes em visitas, conversão e receita. O ranking aparece com "Todos os representantes" no seletor.

### Produção e sazonalidade

Esta aba serve para acompanhar as vendas e o estoque em volta das datas comemorativas e das campanhas, para a fábrica se antecipar. No alto fica o horizonte (próximos 30, 60, 90 ou 180 dias), que vale para a aba inteira. Os blocos aparecem nesta ordem:

| Bloco | O que mostra |
|-------|--------------|
| Próximas datas comemorativas | Um cartão por data do horizonte, da mais próxima à mais distante |
| Estoque baixo nos clientes | Os produtos indicados para a data escolhida e quantos clientes estão com pouco estoque de cada um |
| Vendas por mês, em R$ | As vendas mês a mês no período do painel, em pelo menos três meses, com as datas comemorativas e os períodos das campanhas marcados |

Cada cartão de data comemorativa traz:

- o prazo e o dia da data;
- o período de vendas, que são os 30 dias até a data;
- quanto a carteira vendeu no mesmo período do ano anterior;
- quanto vendeu no período deste ano até hoje ou, se o período ainda não começou, o dia em que ele começa;
- as campanhas em andamento ou programadas que têm algum dia no período. Sem nenhuma, o gestor vê um atalho para criar uma campanha;
- quantos clientes, entre os que têm estoque estimado, estão com estoque baixo de algum produto indicado para a data.

Clicar em um cartão escolhe a data do bloco de estoque. A data mais próxima vem escolhida.

O gráfico de vendas por mês segue o período do painel e mostra sempre pelo menos três meses: em um período curto, como "Este mês", entram também os meses anteriores até completar três. Quando o período termina no mês atual, a série continua com os meses seguintes até o mês da próxima data comemorativa do horizonte. O mês que ainda não chegou aparece como um espaço vazio, sem valor, para não ser lido como venda zero. Com um intervalo de datas que termina em um mês anterior, o gráfico mostra os meses do intervalo, sem os meses seguintes.

No bloco de estoque, cada produto indicado para a data tem uma linha com a contagem de clientes com menos de 10 unidades em estoque. O estoque é uma estimativa por cliente, do ponto de venda. Os clientes com nota fiscal importada não têm estimativa e ficam fora da contagem, e o bloco diz quantos clientes da carteira entram na conta.

### Detalhe de cada número

Em todos os gráficos, passar o mouse sobre uma barra, uma fatia ou um ponto mostra um balão com o resumo. Clicar, ou tocar no celular, abre um painel lateral com os clientes ou as visitas por trás daquele número. Cada cliente do painel leva à ficha. O painel fecha no botão Fechar, com a tecla Esc ou com um clique fora dele. No celular ele ocupa a tela inteira.

| Onde se clica | O que o painel lateral mostra |
|---------------|-------------------------------|
| Indicador Número de visitas | As visitas do período |
| Indicador Clientes visitados | Os clientes visitados e os que ficaram sem visita no período |
| Indicador Conversão em vendas | As visitas que terminaram em venda, com o valor |
| Indicador Clientes esfriando | Os clientes em laranja e vermelho |
| Barra de uma meta | Os clientes por trás do realizado de visitas ou de vendas |
| Fatia do resultado das visitas | As visitas daquele representante com aquele resultado |
| Semana ou mês do ritmo de visitas | As visitas daquela faixa |
| Linha do ranking | As visitas do representante, agrupadas por cliente |
| Mês das vendas por mês | Quem comprou no mês e quanto |
| Cor da distribuição da carteira | Os clientes daquela cor |
| Cidade do mapa, na página de clientes | Os clientes da cidade |
| Produto do estoque baixo | Os clientes com pouco estoque do produto e a quantidade de cada um |

Na tela de Campanhas, com uma campanha escolhida no filtro "Campanha", o nome do representante na tabela de resultados abre as vendas dele na campanha.

### Planilha

O botão Planilha exporta os dados do período em um arquivo CSV, com uma linha por cliente ativo. Em "Personalizado", um intervalo maior que 365 dias não muda o painel, mas vale para a Planilha.

## 10. Campanhas e metas

### Campanhas

O gestor cria campanhas, promoções e eventos com nome, período, descrição, desconto e produtos em destaque. A situação da campanha sai das datas:

| Situação | Quando |
|----------|--------|
| Programada | Antes do primeiro dia |
| Em andamento | Do primeiro ao último dia |
| Encerrada | Depois do último dia |

A tela de Campanhas separa as campanhas em três abas, uma para cada situação: "Em andamento", que é a aba que abre, "Programadas" e "Encerradas". Cada aba mostra quantas campanhas tem. O filtro "Campanha", no alto, lista as campanhas da aba aberta.

No check-in, o representante pode indicar a campanha trabalhada na visita. Com isso, o cartão de cada campanha mostra o valor vendido e as visitas vinculadas de cada representante. Ao escolher uma campanha no filtro "Campanha", a tela mostra só ela, com a tabela de resultados por representante (visitas, clientes atendidos, vendas e conversão), os produtos mais vendidos e a lista das vendas.

#### Encerrar uma campanha

O gestor pode encerrar uma campanha em andamento antes da data prevista, por exemplo quando acaba o estoque do produto principal. O botão "Encerrar" aparece somente nas campanhas em andamento e pede confirmação. Ao confirmar:

- a data de fim da campanha passa a ser o dia anterior. Como o último dia ainda conta como dia de campanha, é essa data que faz a campanha aparecer como encerrada imediatamente;
- a campanha passa para a aba "Encerradas" e deixa de ser oferecida no check-in;
- as visitas e as vendas já ligadas à campanha continuam valendo, para a análise do que ela rendeu até ali;
- as metas da campanha acompanham a nova data de fim, como descrito em [Metas](#metas).

A campanha programada não tem o botão, porque ainda não começou: o gestor pode editar as datas ou excluí-la. A campanha que começou no próprio dia também não pode ser encerrada, porque a data de fim ficaria antes do início. Nesse caso, o sistema orienta a editar as datas ou excluir a campanha.

#### Análise da campanha encerrada

Cada campanha encerrada tem um botão "?" que abre a análise de como ela foi:

| Bloco | O que mostra |
|-------|--------------|
| Período | As datas de início e de fim e a duração em dias |
| Resumo | Total vendido, número de vendas, visitas vinculadas, clientes atendidos, conversão e valor médio por venda |
| Metas da campanha | As metas dos representantes somadas, com o realizado de visitas e de vendas |
| Quem mais vendeu | O representante com o maior valor vendido na campanha (somente para o gestor) |
| Produtos mais vendidos | Os cinco produtos mais vendidos nas visitas da campanha, com a quantidade e o valor |

O gestor vê os números da equipe inteira. O representante vê a análise com os próprios números.

Excluir uma campanha apaga as metas dela. As visitas ligadas a ela continuam existindo, sem a ligação.

### Metas

O gestor define metas de quantidade de visitas e de valor de vendas para cada representante. A meta pode ser semanal (de segunda a domingo), mensal, de um período à escolha (a opção "Personalizado") ou de uma campanha. A meta de campanha precisa caber dentro do período da campanha.

Quando as datas de uma campanha mudam, porque o gestor a editou ou a encerrou, as metas dela são ajustadas automaticamente para caber no novo período: a meta que passava da nova data de fim termina nela, e a que começava antes do novo início começa nele. A meta que ficaria sem nenhum dia dentro do novo período passa a valer a campanha inteira.

O bloco de metas do painel mostra as metas semanais, mensais e de período personalizado e também as metas das campanhas em andamento, com o nome da campanha. O bloco segue o período escolhido no Painel: aparecem as metas que têm pelo menos um dia dentro dele. Uma meta do mês seguinte, por exemplo, só aparece quando o período a alcança. As metas de campanhas programadas ou encerradas aparecem somente na tela de Campanhas, no cartão de cada campanha.

O realizado de visitas é contado das visitas feitas pelo representante no período. O realizado de vendas soma o valor das visitas com venda, que vem da nota fiscal vinculada. Na meta de campanha, contam apenas as visitas ligadas àquela campanha.

## 11. Importação de notas fiscais

A gestão importa as notas fiscais de venda em PDF (DANFE) emitidas pelo sistema de gestão da empresa. É por elas que os clientes e as vendas reais chegam ao ChokoCRM.

O processo tem três momentos:

1. A gestão escolhe um ou mais arquivos PDF, de até 10 MB cada. Um arquivo pode conter várias notas.
2. O sistema lê os arquivos e mostra as notas encontradas para conferência, sem gravar nada.
3. Ao confirmar, as notas são gravadas e o resultado aparece: quantas entraram, quantas foram ignoradas e quais dependem de alguma decisão.

O campo de escolha dos arquivos tem os textos do próprio sistema, e não os do navegador: o botão "Anexar arquivos" e, enquanto nada foi escolhido, "Nenhum arquivo selecionado". Com arquivos escolhidos, ele mostra o nome ou a quantidade.

O que depende de decisão fica em um bloco só, "Pendências (N)", com duas partes: "Criar cliente" (notas cujo comprador ainda não é cliente) e "Ligar à visita" (notas de um cliente que tem uma visita até 15 dias antes do dia da nota). Cada parte tem um "?" que explica a regra. Na parte "Ligar à visita", cada nota diz por que está pendente: a data e o resultado da visita encontrada e quantos dias antes da nota ela aconteceu.

O PDF precisa ter texto selecionável. Foto ou digitalização de nota não é lida.

### O que é lido de cada nota

Chave de acesso, número, série, data de emissão, natureza da operação, dados de quem comprou (nome, CNPJ, endereço e telefone), totais e a lista de itens com código, descrição, quantidade e valor.

### Notas ignoradas

Uma nota é deixada de fora quando não é de venda (devolução, bonificação e remessa), quando não tem chave de acesso, protocolo de autorização, CNPJ do comprador, data ou itens, ou quando a soma dos itens não coincide com o total.

Importar a mesma nota novamente não a duplica: ela é reconhecida pela chave de acesso e apenas atualizada.

### Criar o cliente a partir da nota

Quando o CNPJ da nota ainda não é cliente, a gestão cria o cadastro direto da tela de importação. Ela escolhe o representante que vai atender e pode ajustar o nome fantasia e o intervalo entre visitas. O cliente nasce com razão social, CNPJ, endereço, cidade e telefone lidos da nota. Todas as notas daquele CNPJ passam a ser dele.

É a única forma de criar um cliente.

### Ligação da nota com a visita

A nota encontra o cliente pelo CNPJ. Depois disso, o sistema procura a visita candidata: a visita mais recente do cliente, ainda sem nota ligada, feita no dia da nota ou até 15 dias antes. Uma visita posterior à nota nunca é candidata.

| Situação | O que acontece |
|----------|----------------|
| A visita candidata é do mesmo dia da nota | Na importação, a nota é ligada à visita automaticamente, e os produtos e o total da nota aparecem na visita. Se a visita do mesmo dia é registrada depois da importação, a nota passa a ser uma pendência |
| A visita candidata é de 1 a 15 dias antes da nota | A nota fica pendente, e a gestão decide se liga àquela visita ou se deixa só como compra do cliente |
| O cliente não tem visita nesse período | A nota fica registrada como compra do cliente, sem pendência |

Em todos os casos a nota entra no histórico de compras do cliente e alimenta as sugestões e os gráficos de vendas.

Quando a nota é ligada a uma visita registrada como negociação ou sem venda, o resultado da visita passa a ser Venda, e a cor do cliente acompanha. Na pendência, a tela avisa dessa mudança antes de a gestão confirmar.

A visita candidata não é gravada. Ela é calculada a cada consulta, com as visitas que existem naquele momento, e por isso a lista de pendências acompanha as visitas: a nota cuja visita candidata deixa de existir sai das pendências, e a nota registrada só como compra passa a ser uma pendência quando o cliente recebe uma visita dentro dos 15 dias.

O que fica gravado na nota são as ligações a uma visita (a automática do mesmo dia e a feita pela gestão) e a recusa ("Deixar só no ERP"), junto com a visita recusada. Uma nota recusada não volta às pendências. Enquanto a nota está pendente, os produtos já registrados na visita candidata ficam fora da soma de compras do cliente, para a mesma venda não contar duas vezes. O mesmo vale para a visita recusada.

O bloco "Importações anteriores" lista as últimas importações com a situação de cada nota ("Vinculada à visita", "Pendente" ou "Só no ERP"). A nota vinculada tem o botão "Desvincular", que pede confirmação: a visita fica sem os produtos, a nota passa a "Só no ERP" e não volta a ser vinculada.

### Dia da nota no modo demonstração

Com o modo demonstração ativo, o sistema trabalha em outra data, e as visitas são gravadas nela. Para a nota acompanhar as visitas, o dia de emissão é guardado deslocado pelo mesmo número de dias que separa a data simulada da data real. A nota emitida hoje entra no hoje simulado, e a nota de 16 dias atrás entra 16 dias antes dele.

Com isso, a nota importada durante a simulação entra no volume de compras dos últimos 90 dias da ficha do cliente. A conferência mostra as duas datas, a impressa na nota e a de entrada, sempre que elas são diferentes. Importar a mesma nota novamente grava o dia outra vez, com o deslocamento daquele momento.

Sem simulação, o dia guardado é o da própria nota.

## 12. Usuários

A tela de Usuários fica no menu da conta e só aparece para o gestor. Nela é possível:

- criar uma conta, com nome, usuário, telefone, perfil e senha inicial de pelo menos seis caracteres;
- editar os dados de uma conta;
- inativar e reativar uma conta;
- definir uma senha provisória para quem esqueceu a senha;
- transferir todos os clientes de um representante para outro.

Para transferir um único cliente, o gestor usa o seletor de representante no alto da ficha, descrito em [Ficha do cliente](#4-ficha-do-cliente).

O usuário tem de 3 a 30 caracteres e aceita letras minúsculas, números, ponto, hífen e sublinhado. Não pode haver dois iguais.

O gestor não inativa a própria conta nem muda o próprio perfil. Um representante com clientes ativos na carteira só muda de perfil depois de a carteira ser transferida. A conta inativada não entra mais, mas a sessão que ela já tinha aberta continua até o acesso expirar.

## 13. Modo demonstração

Hoje o sistema trabalha com dados de demonstração: clientes, visitas e vendas fictícios, criados para mostrar todas as telas funcionando.

O modo demonstração permite apresentar o sistema como se fosse outro dia do ano. Ele fica na tela de login e exige a senha da conta Gestão.

Ao escolher uma data, há dois efeitos. O sistema passa a tratar aquela data como o dia de hoje em tudo: cores, agenda, campanhas, metas e sugestões. Além disso, os dados de demonstração são recriados em volta dela, simulando três meses de uso até aquele dia.

A carteira recriada segue um modelo. Os clientes de demonstração de cada representante ficam em rotas por dia da semana, com visitas a cada 7 ou 14 dias. Na lista de clientes, a maior parte fica em dia, alguns em Atenção e alguns em Prioridade, onde há clientes com visita atrasada, com visita vencendo, nunca visitados e rebaixados pela última compra. As quantidades do ambiente variam com o uso, pois os clientes criados a partir de notas fiscais se somam aos de demonstração.

Uma faixa aparece em todas as telas enquanto a simulação está ativa, com a data escolhida ao ligar o modo. O dia simulado avança um dia a cada dia real; a faixa continua mostrando a data escolhida. A opção Voltar ao real encerra a simulação. Ela também pede a senha da conta Gestão e recria os dados de demonstração, agora em volta da data real.

A recriação apaga os clientes de demonstração, com as visitas e os lembretes deles, e também as campanhas e as metas. Ela preserva:

- os clientes criados a partir de notas fiscais, com as visitas, os lembretes e as notas (as visitas perdem apenas a ligação com as campanhas apagadas);
- as contas criadas pelo gestor e a conta Gestão, com as senhas;
- as notas fiscais importadas.

As contas dos representantes de demonstração voltam à senha de demonstração e ficam ativas.

As visitas de venda da demonstração já trazem produtos e valores, como se a nota fiscal tivesse sido importada. Uma nota fiscal importada com a simulação ativa entra na data simulada, como descrito em [Dia da nota no modo demonstração](#dia-da-nota-no-modo-demonstração).

Todos os contatos dos clientes de demonstração usam o mesmo telefone, o da autora do projeto, para que as mensagens de teste pelo WhatsApp cheguem a um número conhecido. Os clientes e contatos já cadastrados no banco usam esse mesmo número. Para os cadastros criados depois, como um cliente criado a partir de uma nota fiscal, o telefone de teste (`VITE_TELEFONE_DE_TESTE`) leva os botões Ligar e WhatsApp de qualquer cliente para esse número, sem aviso na tela.

## 14. Uso como aplicativo

O sistema pode ser instalado no celular ou no computador a partir do navegador. Depois do login, aparece o convite "Use o ChokoCRM como app". Instalado, ele abre em tela cheia e ganha um ícone próprio.

Quando uma versão nova é publicada, o aplicativo mostra o aviso "Nova versão disponível" com o botão Atualizar.

Sem internet, o aplicativo abre e avisa que está sem conexão. Os dados mostrados podem estar desatualizados, e não é possível registrar visitas até a conexão voltar.

## 15. O que o sistema não faz

- Não funciona offline para registrar visitas.
- Não envia mensagens automaticamente pelo WhatsApp. Ele prepara o texto e quem envia é o usuário.
- Não recupera senha por e-mail.
- Não se conecta diretamente ao sistema de gestão da empresa. Os clientes e as vendas entram pela importação das notas fiscais.

Esse último ponto é a melhoria planejada para depois deste projeto. Com a integração direta, os clientes cadastrados no sistema de gestão chegam automaticamente, o modo demonstração e os dados fictícios deixam de existir, e cada representante começa o próprio controle em um sistema sem dados de demonstração, apenas com clientes reais. Os detalhes estão em [Arquitetura](arquitetura.md#melhoria-futura-integração-com-o-sistema-de-gestão).
