# Requisitos e histórias de usuário

Este documento lista o que o ChokoCRM precisa fazer (requisitos funcionais), as qualidades que ele precisa ter (requisitos não funcionais) e as necessidades de quem usa, escritas como histórias de usuário. As regras detalhadas de cada item estão em [Funcionalidades](funcionalidades.md).

## Sumário

1. [Quem usa o sistema](#1-quem-usa-o-sistema)
2. [Requisitos funcionais](#2-requisitos-funcionais)
3. [Requisitos não funcionais](#3-requisitos-não-funcionais)
4. [Histórias de usuário](#4-histórias-de-usuário)
5. [Fluxos de negócio completos](#5-fluxos-de-negócio-completos)
6. [Fora do escopo](#6-fora-do-escopo)

## 1. Quem usa o sistema

| Perfil | Quem é | O que precisa |
|--------|--------|---------------|
| Representante | Vendedor externo da Chokolaten, que visita confeitarias, cafés, empórios e mercados. Usa o sistema no celular, entre uma visita e outra | Saber quem visitar primeiro, lembrar o que cada cliente compra e registrar a visita em poucos toques |
| Gestor | A gestão da empresa, que coordena a equipe de representantes na fábrica. Usa mais o computador e entra pela conta compartilhada Gestão Chokolaten | Enxergar todas as carteiras, saber quais clientes estão esfriando e planejar campanhas e a produção para as datas comemorativas |

## 2. Requisitos funcionais

Cada requisito tem um código, usado nas histórias de usuário da [seção 4](#4-histórias-de-usuário), e aponta para a seção de [Funcionalidades](funcionalidades.md) que traz as regras.

### Acesso e usuários

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF01 | Permitir a entrada com usuário e senha, com o acesso valendo por oito horas | [Acesso e senhas](funcionalidades.md#2-acesso-e-senhas) |
| RF02 | Permitir que cada pessoa troque a própria senha | [Acesso e senhas](funcionalidades.md#2-acesso-e-senhas) |
| RF03 | Permitir que o gestor crie, edite, inative e reative contas e defina uma senha provisória | [Usuários](funcionalidades.md#12-usuários) |
| RF04 | Limitar o representante à própria carteira e dar ao gestor a visão de todas | [Perfis de uso](funcionalidades.md#1-perfis-de-uso) |

### Clientes

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF05 | Listar a carteira com busca por nome, filtro por cidade e abas por situação | [Carteira de clientes e cores](funcionalidades.md#3-carteira-de-clientes-e-cores) |
| RF06 | Dar a cada cliente uma cor, conforme o tempo sem visita, o resultado da última visita e a data da última compra | [Como a cor é definida](funcionalidades.md#como-a-cor-é-definida) |
| RF07 | Mostrar o mapa da carteira por cidade, com a situação mais urgente de cada uma | [Mapa de clientes por cidade](funcionalidades.md#mapa-de-clientes-por-cidade) |
| RF08 | Reunir na ficha do cliente as compras, as sugestões, o histórico de visitas, o cadastro e os contatos | [Ficha do cliente](funcionalidades.md#4-ficha-do-cliente) |
| RF09 | Permitir editar os dados e os contatos do cliente, com um contato principal | [Ficha do cliente](funcionalidades.md#4-ficha-do-cliente) |
| RF10 | Permitir que o gestor inative e reative clientes e transfira a carteira de um representante para outro | [Cliente inativo](funcionalidades.md#cliente-inativo) e [Usuários](funcionalidades.md#12-usuários) |
| RF11 | Permitir alterar o intervalo entre visitas de um cliente, com justificativa registrada | [Intervalo entre visitas](funcionalidades.md#intervalo-entre-visitas) |

### Visitas, agenda e lembretes

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF12 | Registrar a visita em quatro passos, com resultado, descrição e foto obrigatória | [Check-in de visita](funcionalidades.md#5-check-in-de-visita) |
| RF13 | Permitir marcar a data da próxima visita e criar um lembrete | [Próxima visita](funcionalidades.md#próxima-visita) e [Lembretes](funcionalidades.md#lembretes) |
| RF14 | Permitir que o representante corrija a descrição e o resultado de uma visita que ele fez | [Corrigir uma visita](funcionalidades.md#corrigir-uma-visita) |
| RF15 | Apagar as fotos das visitas depois de 90 dias | [Retenção das fotos](funcionalidades.md#retenção-das-fotos) |
| RF16 | Mostrar a agenda nas abas Hoje, Atrasadas, Próximos 7 dias e Lembretes | [Agenda do dia](funcionalidades.md#agenda-do-dia) |
| RF17 | Mostrar o calendário do mês com visitas marcadas, lembretes, datas comemorativas e campanhas | [Calendário](funcionalidades.md#calendário) |
| RF18 | Montar o roteiro do dia pela distância entre as cidades e abrir o trajeto no Google Maps | [Roteiro](funcionalidades.md#roteiro) |
| RF19 | Manter o lembrete aberto até ser marcado como concluído | [Lembretes](funcionalidades.md#lembretes) |

### Compras, sugestões e mensagens

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF20 | Mostrar as compras do cliente, o volume dos últimos 90 dias e o estoque informado | [Compras, estoque e sugestões](funcionalidades.md#7-compras-estoque-e-sugestões) |
| RF21 | Sugerir o que oferecer em cada data comemorativa, comparando com as compras do mesmo período do ano anterior | [Sugestões por época do ano](funcionalidades.md#sugestões-por-época-do-ano) |
| RF22 | Abrir a conversa no WhatsApp com uma mensagem sugerida e a escolha do contato | [Mensagem pelo WhatsApp](funcionalidades.md#8-mensagem-pelo-whatsapp) |

### Painel

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF23 | Mostrar, por período, o número de visitas, os clientes visitados, a conversão em vendas e os clientes esfriando | [Metas e resultados](funcionalidades.md#metas-e-resultados) |
| RF24 | Abrir os clientes ou as visitas por trás de cada número e de cada gráfico | [Detalhe de cada número](funcionalidades.md#detalhe-de-cada-número) |
| RF25 | Mostrar as próximas datas comemorativas, o estoque baixo por produto e as vendas por mês | [Produção e sazonalidade](funcionalidades.md#produção-e-sazonalidade) |
| RF26 | Mostrar ao gestor o ranking dos representantes em visitas, conversão e receita | [Metas e resultados](funcionalidades.md#metas-e-resultados) |
| RF27 | Exportar os dados do período em planilha | [Planilha](funcionalidades.md#planilha) |

### Campanhas e metas

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF28 | Permitir que o gestor crie campanhas com período, desconto e produtos em destaque, e encerre uma campanha em andamento | [Campanhas](funcionalidades.md#campanhas) |
| RF29 | Permitir que o gestor defina metas de visitas e de vendas por representante, e calcular o realizado | [Metas](funcionalidades.md#metas) |
| RF30 | Mostrar as campanhas separadas por situação, o resultado de cada uma por representante e a análise das encerradas | [Campanhas](funcionalidades.md#campanhas) |

### Notas fiscais

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF31 | Importar notas fiscais de venda em PDF, com conferência antes de gravar | [Importação de notas fiscais](funcionalidades.md#11-importação-de-notas-fiscais) |
| RF32 | Criar o cliente a partir dos dados da nota, com o representante escolhido pela gestão | [Criar o cliente a partir da nota](funcionalidades.md#criar-o-cliente-a-partir-da-nota) |
| RF33 | Ligar automaticamente a nota à visita do mesmo dia e deixar como pendência a visita de até 15 dias antes | [Ligação da nota com a visita](funcionalidades.md#ligação-da-nota-com-a-visita) |

### Demonstração e aplicativo

| Código | O sistema deve | Regras em |
|--------|----------------|-----------|
| RF34 | Simular outra data e recriar os dados de demonstração em volta dela | [Modo demonstração](funcionalidades.md#13-modo-demonstração) |
| RF35 | Poder ser instalado como aplicativo, avisar quando há versão nova e quando falta internet | [Uso como aplicativo](funcionalidades.md#14-uso-como-aplicativo) |

O RF34 é um recurso de apresentação e avaliação do projeto: permite mostrar as sugestões e a sazonalidade de qualquer época do ano. Ele não corresponde a uma necessidade dos usuários da empresa e, por isso, não tem história de usuário.

## 3. Requisitos não funcionais

| Código | Qualidade | Como é atendida |
|--------|-----------|-----------------|
| RNF01 | Uso no celular | O layout se adapta à tela: barra inferior no celular, menu lateral a partir de 768 pixels e lista com ficha lado a lado a partir de 1024 pixels |
| RNF02 | Segurança de acesso | Senhas guardadas com bcrypt, token de acesso com validade de oito horas e permissão por perfil e por carteira conferida no servidor em todo pedido |
| RNF03 | Privacidade | Só são guardados os dados necessários ao atendimento. As fotos são apagadas em 90 dias e as mensagens do WhatsApp não são registradas. Ver [Privacidade, segurança e acessibilidade](privacidade-seguranca-e-acessibilidade.md) |
| RNF04 | Acessibilidade | Navegação por teclado, rótulos para leitores de tela, contraste de texto de pelo menos 4,5 para 1 e tabela equivalente para cada gráfico. Ver [Privacidade, segurança e acessibilidade](privacidade-seguranca-e-acessibilidade.md#4-acessibilidade) |
| RNF05 | Dados sempre atuais | A cor do cliente, a agenda, os indicadores e o realizado das metas são calculados a cada consulta e nunca gravados |
| RNF06 | Qualidade do código | Testes automatizados com cobertura mínima de 75 % no servidor e 25 % na interface, e análise do SonarCloud a cada envio. Ver [Testes](testes.md) |
| RNF07 | Publicação automática | Cada envio para a branch `main` passa pelos testes e, se tudo estiver certo, é publicado sem passos manuais. Ver [Instalação e configuração](instalacao-e-configuracao.md#9-ambiente-publicado-no-azure) |
| RNF08 | Acompanhamento em produção | O servidor registra cada pedido, responde em um endereço de verificação de saúde e envia registros e erros ao Application Insights. Ver [Arquitetura](arquitetura.md#7-publicação-e-monitoramento) |
| RNF09 | Instalação simples | O ambiente local é iniciado com o Docker Compose e poucos comandos. Ver [Instalação e configuração](instalacao-e-configuracao.md) |

## 4. Histórias de usuário

Cada história diz quem precisa, o que precisa e para quê. Os critérios de aceite são o que precisa ser verdade para a história ser considerada atendida.

### Representante

**H01. Saber quem visitar primeiro**

Como representante, quero ver minha carteira organizada pela urgência, para saber quem visitar primeiro.

- Cada cliente aparece com uma cor e uma frase que explica a cor.
- A aba Prioridade reúne os clientes em vermelho e laranja, do mais urgente ao menos urgente.
- Uma visita registrada agora muda a cor do cliente na mesma hora.

Requisitos: RF05, RF06.

**H02. Planejar o dia**

Como representante, quero abrir a agenda do dia e o roteiro, para organizar as visitas sem depender de papel.

- A agenda abre na aba Hoje e mostra quantas visitas estão atrasadas.
- O roteiro ordena as visitas do dia pela distância e abre o trajeto no Google Maps.
- O calendário do mês mostra as visitas marcadas e os lembretes.

Requisitos: RF16, RF17, RF18.

**H03. Registrar a visita na hora**

Como representante, quero registrar a visita pelo celular logo depois de atender, para que o histórico do cliente fique completo.

- O registro tem quatro passos e exige descrição, resultado e foto.
- A data da visita não pode estar no futuro.
- Depois de salva, a visita aparece no histórico da ficha.

Requisitos: RF12, RF14.

**H04. Chegar preparado ao cliente**

Como representante, quero consultar a ficha antes de entrar no cliente, para lembrar o que ele compra e saber o que oferecer.

- A ficha mostra a última compra, o volume dos últimos 90 dias e o histórico de visitas.
- Para cada data comemorativa próxima, a ficha sugere aumentar a oferta, manter ou ofertar desconto.
- A sugestão cita os produtos que o cliente mais comprou naquele período.

Requisitos: RF08, RF20, RF21.

**H05. Falar com o cliente pelo WhatsApp**

Como representante, quero abrir a conversa com o contato do cliente já com uma mensagem escrita, para perguntar sobre o estoque sem precisar digitar o texto a cada vez.

- O botão WhatsApp abre a conversa com um texto que pode ser alterado antes do envio.
- Se o cliente tem mais de um contato com telefone, o sistema pergunta com quem falar.
- O sistema não envia nada automaticamente e não guarda a mensagem.

Requisitos: RF22.

**H06. Não esquecer o que foi combinado**

Como representante, quero marcar a próxima visita e criar lembretes, para cumprir o que combinei com o cliente.

- No check-in ou na ficha, é possível marcar a data da próxima visita.
- O lembrete aparece na agenda a partir do dia marcado e fica aberto até ser concluído.
- Uma visita nova não fecha um lembrete antigo.

Requisitos: RF13, RF19.

**H07. Acompanhar minhas metas**

Como representante, quero ver minhas metas e meus resultados, para saber quanto falta.

- O painel mostra os números só da minha carteira.
- Cada meta aparece com o valor combinado e o realizado.
- Clicar em um número abre os clientes ou as visitas por trás dele.

Requisitos: RF04, RF23, RF24, RF29.

**H08. Usar como aplicativo**

Como representante, quero instalar o sistema no celular, para abrir com um toque, sem procurar o endereço no navegador.

- Depois do login, o sistema oferece a instalação.
- Instalado, ele abre em tela cheia e tem ícone próprio.
- Sem internet, ele avisa que está sem conexão e não permite registrar visitas.

Requisitos: RF35.

### Gestor

**H09. Enxergar a equipe inteira**

Como gestor, quero ver os indicadores de toda a equipe e de cada representante, para saber onde agir.

- O painel mostra a equipe inteira ou um representante por vez, em um período à escolha.
- O ranking compara os representantes em visitas, conversão e receita.
- O bloco de clientes esfriando mostra quem está há mais tempo sem visita.

Requisitos: RF04, RF23, RF24, RF26, RF27.

**H10. Trazer as vendas reais para o sistema**

Como gestor, quero importar as notas fiscais emitidas pelo sistema de gestão da empresa, para que os clientes e as vendas entrem sem digitação.

- O sistema lê um ou mais arquivos PDF e mostra as notas para conferência antes de gravar.
- Quando o CNPJ da nota ainda não é cliente, o cadastro é criado a partir dela, com o representante escolhido.
- A nota do mesmo dia de uma visita é ligada a ela automaticamente, e o valor entra nas metas e no painel.
- Importar a mesma nota novamente não a duplica.

Requisitos: RF31, RF32, RF33.

**H11. Criar campanhas e metas**

Como gestor, quero criar campanhas e metas e acompanhar o resultado, para direcionar o esforço da equipe.

- A campanha tem nome, período, desconto e produtos em destaque.
- A meta pode ser semanal, mensal, de um período livre ou de uma campanha.
- A tela de Campanhas mostra, por representante, as visitas, as vendas e a conversão de cada campanha.
- As campanhas ficam separadas em abas: em andamento, programadas e encerradas.
- O gestor pode encerrar uma campanha em andamento, e as metas dela acompanham a nova data de fim.
- A campanha encerrada tem uma análise com os totais de vendas e de visitas, as metas e os produtos mais vendidos.

Requisitos: RF28, RF29, RF30.

**H12. Preparar a produção para as datas comemorativas**

Como gestor, quero ver as próximas datas comemorativas com as vendas do ano anterior e o estoque nos clientes, para a fábrica se antecipar.

- Cada data traz as vendas do mesmo período do ano anterior e as deste ano até hoje.
- O bloco de estoque mostra quantos clientes estão com pouco estoque de cada produto indicado.
- O gráfico de vendas por mês marca as datas comemorativas e os períodos das campanhas.

Requisitos: RF25.

**H13. Cuidar das contas e das carteiras**

Como gestor, quero criar as contas dos representantes e transferir clientes entre eles, para manter as carteiras em ordem quando a equipe muda.

- O gestor cria, edita, inativa e reativa contas.
- Quem esquece a senha recebe uma senha provisória do gestor.
- Todos os clientes de um representante podem ser transferidos para outro de uma vez.

Requisitos: RF03, RF10.

## 5. Fluxos de negócio completos

Um fluxo completo começa em uma necessidade de quem usa e termina em um resultado visível no sistema. O ChokoCRM tem quatro.

### 5.1 Da agenda à visita registrada

1. O representante abre a Agenda e vê as visitas de hoje e as atrasadas.
2. Ele abre o roteiro e segue o trajeto no Google Maps.
3. No cliente, consulta a ficha: últimas compras e sugestões da época.
4. Depois de atender, faz o check-in, com resultado, descrição e foto.
5. O sistema recalcula a cor do cliente, tira o cliente das atrasadas e mostra a visita no histórico.

### 5.2 Da nota fiscal à venda no painel

1. O representante marca no check-in que a visita terminou em venda.
2. A gestão importa a nota fiscal em PDF daquela venda.
3. O sistema confere a nota, encontra o cliente pelo CNPJ e liga a nota à visita do mesmo dia. Se a visita foi até 15 dias antes, a gestão confirma a ligação.
4. Os produtos e o valor aparecem na visita e no histórico de compras do cliente.
5. O valor entra no realizado das metas, no ranking e nas vendas por mês do painel.

### 5.3 Da campanha ao resultado

1. O gestor cria a campanha, com período, desconto e produtos em destaque.
2. Ele define, para cada representante, uma meta ligada à campanha.
3. O representante indica a campanha no check-in das visitas em que a trabalhou.
4. A tela de Campanhas mostra o resultado por representante, e o painel mostra a meta com o realizado enquanto a campanha está em andamento.
5. Quando a campanha termina, ou quando o gestor a encerra antes da data, a análise reúne o que ela rendeu.

### 5.4 Do cliente esfriando ao contato

1. O painel mostra à gestão quantos clientes estão em laranja e vermelho.
2. O gestor clica no indicador e vê a lista dos clientes, com o link para a ficha de cada um.
3. Na carteira do representante, esses clientes estão na aba Prioridade.
4. O representante abre a conversa no WhatsApp com a mensagem sugerida ou marca a próxima visita.
5. Com a visita registrada, a cor do cliente é recalculada e ele sai da lista de atrasados.

## 6. Fora do escopo

O que o sistema não faz, e o motivo de cada escolha, está em [O que o sistema não faz](funcionalidades.md#15-o-que-o-sistema-não-faz). A ligação direta com o sistema de gestão da empresa é a melhoria planejada para depois deste projeto.
