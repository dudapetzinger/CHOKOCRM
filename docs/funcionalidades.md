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

O sistema tem dois perfis.

O representante cuida de uma carteira de clientes. Ele só vê e altera os clientes da própria carteira. É quem cadastra clientes, registra visitas e envia mensagens.

O gestor enxerga todas as carteiras. Nas telas de clientes, agenda e painel, um seletor permite ver a equipe inteira ou um representante por vez. É quem cria usuários, campanhas e metas, importa notas fiscais e transfere clientes entre representantes.

| Ação | Representante | Gestor |
|------|:-------------:|:------:|
| Ver clientes, agenda e painel | Só a própria carteira | Todas as carteiras |
| Cadastrar cliente pelo formulário | Sim | Não |
| Criar cliente a partir de uma nota fiscal | Não | Sim |
| Editar dados e contatos do cliente | Sim | Sim |
| Registrar visita e enviar foto | Sim | Não |
| Alterar o intervalo entre visitas | Sim | Não |
| Marcar a data da próxima visita | Sim | Sim |
| Gerar mensagem de estoque | Sim | Não |
| Concluir lembrete | Sim | Sim |
| Transferir clientes de carteira | Não | Sim |
| Criar campanhas e metas | Não | Sim |
| Importar notas fiscais | Não | Sim |
| Gerenciar usuários | Não | Sim |

A tela inicial depende do perfil: o representante entra pela Agenda e o gestor entra pelo Painel.

## 2. Acesso e senhas

O acesso é feito com e-mail e senha. O login vale por oito horas.

Qualquer usuário pode trocar a própria senha no menu da conta, em Alterar senha, informando a senha atual.

Não há recuperação de senha por e-mail. Quem esquece a senha pede ao gestor, que define uma senha provisória na tela de Usuários. A pessoa entra com ela e escolhe uma nova.

Uma conta inativada pelo gestor não consegue mais entrar. Os clientes dela continuam na carteira até serem transferidos.

## 3. Carteira de clientes e cores

A tela Clientes lista a carteira com busca por nome, filtro por cidade e abas por situação. Cada cliente aparece com uma cor e uma frase curta que explica a cor, como "Atrasado · 42 dias sem visita".

### Como a cor é definida

A cor depende de duas coisas: há quanto tempo o cliente foi visitado e se a última visita terminou em venda.

| Última visita | Cor |
|---------------|-----|
| Há até 15 dias, com venda | Verde |
| Há até 15 dias, sem venda | Amarelo |
| Entre 16 e 30 dias | Laranja |
| Há mais de 30 dias, ou nunca visitado | Vermelho |

Há um ajuste pela última compra. Se o cliente está verde ou amarelo, mas a última compra dele foi há mais de 60 dias, a cor passa a laranja. A visita está em dia, mas o cliente parou de comprar, e isso merece atenção.

Os dias são contados pelo calendário de São Paulo, e não em períodos de 24 horas.

A cor nunca é gravada. Ela é calculada toda vez que a lista é aberta, então uma visita registrada agora muda a cor na mesma hora.

### Abas

| Aba | Cores | Sentido |
|-----|-------|---------|
| Prioridade | Vermelho e laranja | Quem precisa de visita primeiro |
| Atenção | Amarelo | Visitado há pouco, mas sem venda |
| Em dia | Verde | Visitado há pouco, com venda |
| Todos | Todas | A carteira inteira |

Dentro de cada aba, os clientes aparecem do mais urgente para o menos urgente.

### Cadastro

O representante cadastra o cliente com razão social, nome fantasia, CNPJ, cidade, endereço, telefone e, se quiser, e-mail e o código do cliente no sistema de gestão da empresa. O cliente entra na carteira de quem cadastrou. O CNPJ não pode se repetir.

## 4. Ficha do cliente

A ficha reúne tudo sobre o cliente em três abas.

A aba ERP e sugestões mostra a última compra, o volume comprado, o histórico de compras, o estoque informado e as sugestões do que oferecer na época do ano.

A aba Visitas mostra a última visita em destaque e as anteriores, com o resultado, a descrição, a foto e o pedido de cada uma. Quando a visita corresponde a uma nota fiscal importada, o pedido aparece como "Pedido conforme NF", com o número e o total da nota.

A aba Cadastro mostra os dados do cliente e os contatos, e permite editar, inativar e reativar o cliente. Um dos contatos é o principal.

No alto da ficha ficam as ações do dia a dia: iniciar o check-in, abrir a conversa no WhatsApp e ver ou alterar a data da próxima visita.

### Intervalo entre visitas

Cada cliente tem um intervalo previsto entre visitas, em dias. O padrão é 15, e o valor aceito vai de 1 a 365. O representante pode alterar o intervalo, mas precisa escrever uma justificativa. Cada alteração fica registrada com data, autor, valor antigo, valor novo e motivo.

### Próxima visita

A data da próxima visita vem de uma destas fontes, nesta ordem:

1. a data marcada pelo representante no check-in ou na ficha;
2. a data da última visita mais o intervalo do cliente;
3. para quem nunca foi visitado, a data do cadastro mais o intervalo.

Uma data marcada vale até o cliente receber uma visita naquele dia ou depois. A partir daí ela é considerada cumprida e o cliente volta a seguir o intervalo.

### Cliente inativo

Um cliente inativo não recebe novas visitas e sai da agenda. O histórico dele continua disponível.

## 5. Check-in de visita

O check-in é o registro da visita, feito pelo representante, de preferência na hora. Ele tem quatro passos.

| Passo | O que é informado |
|-------|-------------------|
| A visita | Data e hora, pessoa atendida e, se houver, a campanha trabalhada |
| Resultado | Venda, negociação ou sem venda. Em caso de venda, o pedido |
| O que aconteceu | Descrição da visita e foto |
| Próximos passos | Data da próxima visita e lembrete, os dois opcionais |

Regras:

- A descrição é obrigatória e precisa ter pelo menos três caracteres.
- A data da visita não pode estar no futuro.
- A foto é obrigatória no aplicativo. São aceitas imagens JPEG, PNG ou WebP de até 5 MB, uma por visita.
- O pedido só existe quando o resultado é venda. Ele tem até 30 produtos, escolhidos do catálogo. O preço vem do catálogo e é copiado para o pedido, de modo que mudanças futuras de preço não alteram pedidos antigos.
- A data da próxima visita, quando informada, precisa ser de hoje em diante.
- O lembrete tem um texto de até 200 caracteres e uma data, de hoje em diante.
- Não é possível registrar visita em cliente inativo nem vincular a visita a uma campanha encerrada.

Depois de registrada, a visita só aceita uma correção: o autor pode ajustar a descrição.

### Retenção das fotos

As fotos ficam guardadas por 90 dias. Depois disso, uma rotina diária as apaga, e a visita passa a mostrar "Foto removida após 90 dias". O restante do registro permanece.

### Lembretes

O lembrete é uma tarefa com data, ligada a um cliente. Ele aparece na agenda a partir do dia marcado, no calendário e na ficha, e continua aberto até o representante dono da carteira ou o gestor marcá-lo como concluído. Novas visitas não fecham lembretes antigos.

## 6. Agenda, calendário e roteiro

### Agenda do dia

A agenda organiza o trabalho do representante em quatro blocos:

| Bloco | O que entra |
|-------|-------------|
| Atrasadas | Clientes cuja próxima visita já passou |
| Hoje | Clientes com visita prevista para hoje |
| Próximos 7 dias | Clientes com visita prevista para a semana seguinte |
| Lembretes | Lembretes abertos com data até hoje |

Nas atrasadas e nas de hoje, a ordem é pela cor, do vermelho ao verde, e depois pelos dias de atraso.

Todos os dias, às 6h, uma rotina do servidor registra em log quantas visitas atrasadas e previstas cada representante tem.

### Calendário

O calendário do mês mostra apenas o que foi marcado: visitas com data definida, lembretes, datas comemorativas e, para o gestor, as campanhas.

### Roteiro

O roteiro do dia pega as visitas de hoje, ordena pela distância entre as cidades e abre o trajeto no Google Maps. As distâncias são estimadas a partir das coordenadas dos municípios de Santa Catarina.

## 7. Compras, estoque e sugestões

### De onde vêm os dados de compra

As compras de cada cliente podem vir de duas fontes. A primeira são as notas fiscais em PDF importadas pela gestão, somadas aos pedidos registrados nas visitas. A segunda é uma simulação, usada para demonstrar o sistema: os números são gerados a partir do código do cliente e são sempre os mesmos para o mesmo código.

No funcionamento padrão, o sistema escolhe uma fonte por cliente. Se o CNPJ do cliente tem nota importada, ele mostra as notas. Se não tem, mostra a simulação. As duas fontes nunca são somadas.

A informação de estoque existe apenas na simulação, porque as notas fiscais não trazem o estoque do cliente.

### Sugestões por época do ano

O sistema conhece cinco datas comemorativas: Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais e Natal. As datas móveis são calculadas para cada ano. O período de vendas de cada data são os 30 dias anteriores a ela.

Para cada data que cai nos próximos 90 dias (o prazo pode ser ajustado de 30 a 180 dias), a ficha compara o que o cliente comprou nesse mesmo período do ano anterior com a média de compras dele ao longo de um ano:

| Comparação com a média | Sugestão |
|------------------------|----------|
| Comprou pelo menos 20 % acima | Aumentar a oferta |
| Comprou pelo menos 20 % abaixo | Ofertar desconto |
| Ficou perto da média | Criar promoção |

A sugestão cita os três produtos que o cliente mais comprou naquele período. Se não há compras para comparar, a ficha avisa que falta histórico.

## 8. Mensagem pelo WhatsApp

O representante pode enviar ao cliente uma mensagem perguntando como está o estoque. O sistema monta o texto, incluindo os produtos da data comemorativa do momento quando há uma, e abre a conversa no WhatsApp com o texto já escrito. O representante revisa e envia.

Cada mensagem gerada fica registrada no histórico do cliente. O sistema registra que a mensagem foi gerada, e não que foi entregue, porque o envio acontece fora dele.

## 9. Painel

O painel mostra os resultados de um período. O período pode ser de 30, 90 ou 365 dias, ou um intervalo de datas à escolha, de até 365 dias. O representante vê os números da própria carteira. O gestor vê a equipe inteira ou um representante.

O painel tem duas abas.

### Metas e resultados

| Indicador | Como é calculado |
|-----------|------------------|
| Visitas no período | Total de visitas e média por cliente ativo |
| Taxa de registro | Parte dos clientes ativos que teve ao menos uma visita ou uma mensagem no período |
| Conversão em vendas | Parte das visitas que terminou em venda |
| Clientes inativos | Clientes em laranja ou vermelho, com a distribuição da carteira pelas quatro cores |

Abaixo dos indicadores ficam as metas com o realizado, o resultado das visitas por representante, o ritmo de visitas ao longo do período (por semana em períodos de até 91 dias, por mês nos maiores) e, para o gestor, o ranking dos representantes em visitas, conversão e receita.

### Produção e sazonalidade

Esta aba mostra as vendas mês a mês com as datas comemorativas marcadas, a lista de clientes que estão esfriando, a época do ano e o mapa de clientes por cidade, com o contorno de Santa Catarina.

Ela traz também os alertas de produção: clientes com estoque baixo de produtos indicados para uma data comemorativa que está chegando. Servem para a fábrica se antecipar.

### Planilha

O botão Planilha exporta os dados do período em um arquivo CSV, com uma linha por cliente.

Em todos os gráficos, passar o mouse ou tocar em uma barra mostra os clientes daquela fatia.

## 10. Campanhas e metas

### Campanhas

O gestor cria campanhas, promoções e eventos com nome, período, descrição, desconto e produtos em destaque. A situação da campanha sai das datas:

| Situação | Quando |
|----------|--------|
| Programada | Antes do primeiro dia |
| Em andamento | Do primeiro ao último dia |
| Encerrada | Depois do último dia |

No check-in, o representante pode indicar a campanha trabalhada na visita. Com isso, a tela de Campanhas mostra o resultado de cada uma por representante: visitas, clientes atendidos, vendas, conversão e os produtos mais vendidos.

Excluir uma campanha apaga as metas dela. As visitas ligadas a ela continuam existindo, sem a ligação.

### Metas

O gestor define metas de quantidade de visitas e de valor de vendas para cada representante. A meta pode ser semanal (de segunda a domingo), mensal, de um período livre ou de uma campanha. A meta de campanha precisa caber dentro do período da campanha.

O realizado é contado das visitas feitas pelo representante no período e dos pedidos das visitas com venda. Na meta de campanha, contam apenas as visitas ligadas àquela campanha.

## 11. Importação de notas fiscais

A gestão importa as notas fiscais de venda em PDF (DANFE) emitidas pelo sistema de gestão da empresa. É assim que as compras reais chegam ao ChokoCRM.

O processo tem três momentos:

1. A gestão escolhe um ou mais arquivos PDF, de até 10 MB cada. Um arquivo pode conter várias notas.
2. O sistema lê os arquivos e mostra as notas encontradas para conferência, sem gravar nada.
3. Ao confirmar, as notas são gravadas e o resultado aparece: quantas entraram, quantas foram ignoradas e quais dependem de alguma decisão.

O PDF precisa ter texto selecionável. Foto ou digitalização de nota não é lida.

### O que é lido de cada nota

Chave de acesso, número, série, data de emissão, natureza da operação, dados de quem comprou (nome, CNPJ, endereço e telefone), totais e a lista de itens com código, descrição, quantidade e valor.

### Notas ignoradas

Uma nota é deixada de fora quando não é de venda (devolução, bonificação e remessa), quando não tem chave de acesso, protocolo de autorização, CNPJ do comprador, data ou itens, ou quando a soma dos itens não bate com o total.

Importar a mesma nota de novo não a duplica: ela é reconhecida pela chave de acesso e apenas atualizada.

### Ligação com o cliente e com a visita

A nota encontra o cliente pelo CNPJ. Depois disso, o sistema tenta ligar a nota a uma visita:

| Situação | O que acontece |
|----------|----------------|
| A última visita do cliente foi no mesmo dia da nota | A nota é ligada à visita, e os itens da nota passam a ser o pedido da visita |
| A última visita foi em outro dia | A nota fica pendente, e a gestão decide se liga àquela visita ou se deixa só como compra |
| O cliente não tem visita | A nota fica registrada como compra |
| O CNPJ não é de nenhum cliente | A nota fica aguardando, e a gestão pode criar o cliente |

### Criar o cliente a partir da nota

Quando o CNPJ da nota ainda não é cliente, a gestão cria o cadastro direto da tela de importação. Ela escolhe o representante que vai atender, e o cliente nasce com razão social, CNPJ, endereço, cidade e telefone lidos da nota. Todas as notas daquele CNPJ passam a ser dele.

## 12. Usuários

A tela de Usuários fica no menu da conta e só aparece para o gestor. Nela é possível:

- criar uma conta, com nome, e-mail, telefone, perfil e senha inicial de pelo menos seis caracteres;
- editar os dados de uma conta;
- inativar e reativar uma conta;
- definir uma senha provisória para quem esqueceu a senha;
- transferir todos os clientes de um representante para outro.

## 13. Modo demonstração

O modo demonstração permite apresentar o sistema como se fosse outro dia do ano. Ele fica na tela de login e exige a senha da conta Gestão.

Ao escolher uma data, duas coisas acontecem. O sistema passa a tratar aquela data como o dia de hoje em tudo: cores, agenda, campanhas, metas e sugestões. E os dados de demonstração são recriados em volta dela, simulando três meses de uso até aquele dia.

Uma faixa com a data aparece em todas as telas enquanto a simulação está ativa. A data simulada avança um dia a cada dia real. A opção Voltar ao real encerra a simulação.

A recriação apaga os clientes de demonstração, com as visitas, os pedidos e os lembretes deles, e também as campanhas e as metas. Ela preserva:

- os clientes cadastrados à mão ou criados a partir de uma nota fiscal, com todo o histórico;
- as contas de usuário e as senhas;
- as notas fiscais importadas.

## 14. Uso como aplicativo

O sistema pode ser instalado no celular ou no computador a partir do navegador. Depois do login, aparece o convite "Use o ChokoCRM como app". Instalado, ele abre em tela cheia e ganha um ícone próprio.

Quando uma versão nova é publicada, o aplicativo mostra o aviso "Nova versão disponível" com o botão Atualizar.

Sem internet, o aplicativo abre e avisa que está sem conexão. Os dados mostrados podem estar desatualizados, e não é possível registrar visitas até a conexão voltar.

## 15. O que o sistema não faz

- Não funciona offline para registrar visitas.
- Não envia mensagens sozinho pelo WhatsApp. Ele prepara o texto e quem envia é o representante.
- Não se conecta diretamente ao sistema de gestão da empresa. As compras entram pela importação das notas fiscais.
- Não recupera senha por e-mail.
