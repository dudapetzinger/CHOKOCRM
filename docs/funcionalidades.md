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

O representante cuida de uma carteira de clientes. Ele só vê e altera os clientes da própria carteira. É quem registra as visitas e fala com os clientes.

O gestor enxerga todas as carteiras. Nas telas de clientes, agenda e painel, um seletor permite ver a equipe inteira ou um representante por vez. É quem importa as notas fiscais, cria os clientes, as campanhas, as metas e os usuários.

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
| Importar notas fiscais | Não | Sim |
| Gerenciar usuários | Não | Sim |

A tela inicial depende do perfil: o representante entra pela Agenda e o gestor entra pelo Painel.

## 2. Acesso e senhas

O acesso é feito com usuário e senha. O usuário é um nome curto, como `eduarda` ou `gestao`, definido pelo gestor ao criar a conta. O acesso vale por oito horas.

Qualquer pessoa pode trocar a própria senha no menu da conta, em Alterar senha, informando a senha atual.

Quem esquece a senha pede ao gestor, que define uma senha provisória na tela de Usuários. A pessoa entra com a senha provisória e depois a troca por uma só dela, no próprio perfil, em Alterar senha. Não há recuperação de senha por e-mail.

Uma conta inativada pelo gestor não consegue mais entrar. Os clientes dela continuam na carteira até serem transferidos.

## 3. Carteira de clientes e cores

A tela Clientes lista a carteira com busca por nome, filtro por cidade e abas por situação. Cada cliente aparece com uma cor e uma frase curta que explica a cor, como "Atrasado · 42 dias sem visita".

### Como o cliente entra no sistema

O cliente é criado pela gestão, a partir de uma nota fiscal importada. O sistema lê na nota a razão social, o CNPJ, o endereço, a cidade e o telefone, e a gestão escolhe o representante que vai atender. O representante não cadastra clientes. Ele completa os dados que a nota não traz, como os contatos.

O passo a passo está na seção [Importação de notas fiscais](#11-importação-de-notas-fiscais).

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

| Aba | O que mostra | Sentido |
|-----|--------------|---------|
| Prioridade | Clientes em vermelho e laranja | Quem precisa de visita primeiro |
| Atenção | Clientes em amarelo | Visitado há pouco, mas sem venda |
| Em dia | Clientes em verde | Visitado há pouco, com venda |
| Todos | A carteira inteira, com os inativos no fim | Consulta geral |

Dentro de cada aba, os clientes aparecem do mais urgente para o menos urgente.

### Cliente inativo

Só a gestão inativa e reativa um cliente. O cliente inativo:

- aparece apenas na aba Todos, no fim da lista, com a etiqueta "Inativo";
- não tem cor, porque não está mais sendo visitado;
- sai da agenda, do roteiro e dos indicadores do painel;
- não recebe novas visitas;
- mantém todo o histórico, que continua disponível na ficha.

## 4. Ficha do cliente

A ficha reúne tudo sobre o cliente em três abas.

A aba ERP e sugestões mostra a última compra, o volume comprado, o histórico de compras, o estoque informado e as sugestões do que oferecer na época do ano. Para o representante, com o cliente ativo, ela traz também o cartão Mensagem de estoque: um texto sugerido que pode ser editado, a escolha do contato e o botão Abrir no WhatsApp. Nada do que é escrito ali fica guardado.

A aba Visitas mostra a última visita em destaque e as anteriores, com o resultado, a descrição e a foto de cada uma. Quando a visita tem produtos, vindos de uma nota fiscal vinculada ou dos dados de demonstração, aparecem também os produtos e o total, e o número da nota quando há nota.

A aba Cadastro mostra os dados do cliente e os contatos. Um dos contatos é o principal.

No alto da ficha ficam as ações do dia a dia: iniciar o check-in, abrir a conversa no WhatsApp e ver ou alterar a data da próxima visita.

### Intervalo entre visitas

Cada cliente tem um intervalo previsto entre visitas, em dias. O padrão é 15, e o valor aceito vai de 1 a 365. O representante pode alterar o intervalo, mas precisa escrever uma justificativa. Cada alteração fica registrada com data, autor, valor antigo, valor novo e motivo.

### Próxima visita

A data da próxima visita vem de uma destas fontes, nesta ordem:

1. a data marcada pelo representante no check-in ou na ficha;
2. a data da última visita mais o intervalo do cliente;
3. para quem nunca foi visitado, a data de criação do cliente mais o intervalo.

Uma data marcada vale até o cliente receber uma visita naquele dia ou depois. A partir daí ela é considerada cumprida e o cliente volta a seguir o intervalo.

## 5. Check-in de visita

O check-in é o registro da visita, feito pelo representante, de preferência na hora. Ele tem quatro passos.

| Passo | O que é informado |
|-------|-------------------|
| A visita | Data e hora, pessoa atendida e, se houver, a campanha trabalhada |
| Resultado | Venda, negociação ou sem venda |
| O que aconteceu | Descrição da visita e foto |
| Próximos passos | Data da próxima visita e lembrete, os dois opcionais |

Regras:

- A descrição é obrigatória e precisa ter pelo menos três caracteres.
- A data da visita não pode estar no futuro.
- A foto é obrigatória no aplicativo. São aceitas imagens JPEG, PNG ou WebP de até 5 MB, uma por visita.
- A data da próxima visita, quando informada, precisa ser de hoje em diante.
- O lembrete tem um texto de até 200 caracteres e uma data, de hoje em diante.
- Não é possível registrar visita em cliente inativo nem vincular a visita a uma campanha encerrada.

### Venda e nota fiscal

No check-in, o representante informa apenas que houve venda. Ele não digita produtos nem valores.

Os produtos e o valor chegam depois, quando a gestão importa a nota fiscal daquela venda (nos dados de demonstração, já vêm gravados na visita). O sistema liga a nota à visita pela data, seguindo as regras da seção [Importação de notas fiscais](#11-importação-de-notas-fiscais). A partir daí, a visita passa a mostrar os produtos e o total da nota, e a venda entra nas metas, nas campanhas e no ranking.

### Corrigir uma visita

Depois de registrada, a visita pode ser corrigida pelo representante que a fez. Ele pode alterar a descrição e o resultado. Há uma exceção: uma visita que já tem produtos ou uma nota fiscal vinculada continua como venda, e o sistema recusa a troca do resultado.

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

O calendário do mês mostra o que foi marcado. Caixas de seleção acima dele permitem escolher o que aparece:

| Caixa | O que mostra | Quem vê |
|-------|--------------|---------|
| Visitas | Visitas com data marcada | Representante e gestor |
| Lembretes | Lembretes abertos | Representante e gestor |
| Datas comemorativas | Páscoa, Dia das Mães e as outras datas do ano | Representante e gestor |
| Campanhas | Período de cada campanha | Gestor |

Todas vêm marcadas. Desmarcar uma delas tira aquele tipo do calendário, para a pessoa ver, por exemplo, só os lembretes.

### Roteiro

O roteiro do dia pega as visitas de hoje, ordena pela distância entre as cidades e abre o trajeto no Google Maps. As distâncias são estimadas a partir das coordenadas dos municípios de Santa Catarina.

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

Para cada data que cai nos próximos 90 dias (o prazo pode ser ajustado de 30 a 180 dias), a ficha compara o que o cliente comprou nesse mesmo período do ano anterior com a média de compras dele ao longo de um ano:

| Comparação com a média | Sugestão |
|------------------------|----------|
| Comprou pelo menos 20 % acima | Aumentar a oferta |
| Comprou pelo menos 20 % abaixo | Ofertar desconto |
| Ficou perto da média | Criar promoção |

A sugestão cita os três produtos que o cliente mais comprou naquele período. Se não há compras para comparar, a ficha avisa que falta histórico.

## 8. Mensagem pelo WhatsApp

O botão WhatsApp, no alto da ficha, abre a conversa com o cliente. Para o representante, com o cliente ativo, a conversa abre já com uma mensagem escrita, perguntando como está o estoque. Quando há uma data comemorativa próxima, a mensagem cita os produtos indicados para ela. Para o gestor e para um cliente inativo, o link leva só o número, sem texto.

Se o cliente tem dois ou mais contatos com telefone válido, o botão mostra a lista para a pessoa escolher com quem quer falar. O contato principal aparece primeiro. Se há um contato só, a conversa abre direto.

O envio acontece no WhatsApp, pelas mãos de quem está usando. A pessoa pode alterar o texto antes de enviar. Por isso o sistema não guarda registro dessas mensagens: ele não teria como saber o que foi realmente enviado.

## 9. Painel

O painel mostra os resultados de um período. O período pode ser de 30, 90 ou 365 dias, ou um intervalo de datas à escolha, de até 365 dias. O representante vê os números da própria carteira. O gestor vê a equipe inteira ou um representante.

O painel tem duas abas.

### Metas e resultados

| Indicador | Como é calculado |
|-----------|------------------|
| Visitas no período | Total de visitas e média por cliente ativo |
| Taxa de registro | Parte dos clientes ativos que recebeu ao menos uma visita no período |
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

O realizado de visitas é contado das visitas feitas pelo representante no período. O realizado de vendas soma o valor das visitas com venda, que vem da nota fiscal vinculada. Na meta de campanha, contam apenas as visitas ligadas àquela campanha.

## 11. Importação de notas fiscais

A gestão importa as notas fiscais de venda em PDF (DANFE) emitidas pelo sistema de gestão da empresa. É por elas que os clientes e as vendas reais chegam ao ChokoCRM.

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

### Criar o cliente a partir da nota

Quando o CNPJ da nota ainda não é cliente, a gestão cria o cadastro direto da tela de importação. Ela escolhe o representante que vai atender, e o cliente nasce com razão social, CNPJ, endereço, cidade e telefone lidos da nota. Todas as notas daquele CNPJ passam a ser dele.

É a única forma de criar um cliente.

### Ligação da nota com a visita

A nota encontra o cliente pelo CNPJ. Depois disso, o sistema compara a data da nota com a data da última visita do cliente:

| Situação | O que acontece |
|----------|----------------|
| A última visita foi no mesmo dia da nota | A nota é ligada à visita sozinha, e os produtos e o total da nota passam a aparecer na visita |
| A última visita foi em outro dia | A nota fica pendente, e a gestão decide se liga àquela visita ou se deixa só como compra do cliente |
| O cliente não tem visita | A nota fica registrada como compra do cliente |

Em todos os casos a nota entra no histórico de compras do cliente e alimenta as sugestões e os gráficos de vendas.

## 12. Usuários

A tela de Usuários fica no menu da conta e só aparece para o gestor. Nela é possível:

- criar uma conta, com nome, usuário, telefone, perfil e senha inicial de pelo menos seis caracteres;
- editar os dados de uma conta;
- inativar e reativar uma conta;
- definir uma senha provisória para quem esqueceu a senha;
- transferir todos os clientes de um representante para outro.

O usuário tem de 3 a 30 caracteres e aceita letras minúsculas, números, ponto, hífen e sublinhado. Não pode haver dois iguais.

## 13. Modo demonstração

Hoje o sistema trabalha com dados de demonstração: clientes, visitas e vendas fictícios, criados para mostrar todas as telas funcionando.

O modo demonstração permite apresentar o sistema como se fosse outro dia do ano. Ele fica na tela de login e exige a senha da conta Gestão.

Ao escolher uma data, duas coisas acontecem. O sistema passa a tratar aquela data como o dia de hoje em tudo: cores, agenda, campanhas, metas e sugestões. E os dados de demonstração são recriados em volta dela, simulando três meses de uso até aquele dia.

Uma faixa com a data aparece em todas as telas enquanto a simulação está ativa. A data simulada avança um dia a cada dia real. A opção Voltar ao real encerra a simulação.

A recriação apaga os clientes de demonstração, com as visitas e os lembretes deles, e também as campanhas e as metas. Ela preserva:

- os clientes criados a partir de notas fiscais, com todo o histórico;
- as contas de usuário e as senhas;
- as notas fiscais importadas.

As visitas de venda da demonstração já trazem produtos e valores, como se a nota fiscal tivesse sido importada.

Todos os contatos dos clientes de demonstração usam o mesmo telefone, o da autora do projeto, para que as mensagens de teste pelo WhatsApp cheguem a um número conhecido.

## 14. Uso como aplicativo

O sistema pode ser instalado no celular ou no computador a partir do navegador. Depois do login, aparece o convite "Use o ChokoCRM como app". Instalado, ele abre em tela cheia e ganha um ícone próprio.

Quando uma versão nova é publicada, o aplicativo mostra o aviso "Nova versão disponível" com o botão Atualizar.

Sem internet, o aplicativo abre e avisa que está sem conexão. Os dados mostrados podem estar desatualizados, e não é possível registrar visitas até a conexão voltar.

## 15. O que o sistema não faz

- Não funciona offline para registrar visitas.
- Não envia mensagens sozinho pelo WhatsApp. Ele prepara o texto e quem envia é a pessoa.
- Não recupera senha por e-mail.
- Não se conecta diretamente ao sistema de gestão da empresa. Os clientes e as vendas entram pela importação das notas fiscais.

Esse último ponto é a melhoria planejada para depois deste projeto. Com a integração direta, os clientes cadastrados no sistema de gestão chegam sozinhos, o modo demonstração e os dados fictícios deixam de existir, e cada representante começa o próprio controle em um sistema zerado, só com clientes reais. Os detalhes estão em [Arquitetura](arquitetura.md#melhoria-futura-integração-com-o-sistema-de-gestão).
