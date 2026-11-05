# Seed realista — dados de demonstração com cara de sistema de verdade

**Data:** 2026-11-06 · **Tamanho:** mudança pequena (um arquivo de dados + testes do seed) · **Status:** aprovado em conversa (06/11)

## 1. Intenção

A parceira pediu "mais dados mockados" e, ao detalhar, o que quer é que o app **pareça um sistema de verdade, organizado**: ao abrir a lista, a ficha, a agenda, o painel e o calendário, quem olha deve ver a carteira de uma fábrica de chocolate do Vale do Itajaí e do norte de SC, não um conjunto de exemplos. O volume dobra (13 → 26 clientes) e, mais importante, cada registro fica completo e coerente.

Serve aos testes com os representantes (novembro) e à apresentação de 22/11 (seed reset em produção 1–2 dias antes).

## 2. Goals, non-goals, anti-goals

**Goals**
- 26 clientes (os 13 atuais revisados + 13 novos), ~34 check-ins, contatos, próximas visitas e lembretes na mesma proporção.
- Cadastro completo e coerente em todo cliente: CNPJ válido (dígitos verificadores certos — a importação de notas casa por CNPJ), razão social diferente do nome fantasia, endereço com rua e número, telefone no padrão de SC `(47) 9xxxx-xxxx` ou fixo `(47) 3xxx-xxxx`, e-mail no domínio do cliente, 1 ou 2 contatos com cargo (proprietário, comprador, gerente) e exatamente um principal.
- Carteiras organizadas como rota: **Eduarda** no eixo Joinville, Jaraguá do Sul, Corupá, São Bento do Sul e Pomerode (16 clientes); **Rafael** no eixo Blumenau, Indaial, Timbó, Brusque, Itajaí e Rio do Sul (10 clientes). Cidades repetidas (para o filtro de cidade e o mapa agruparem).
- Histórico que respeita a recorrência: visitas passadas de cada cliente perto do intervalo cadastrado (quinzenal, mensal, bimestral), descrições na voz do representante, pedidos com produtos do catálogo e valores plausíveis. A cor da lista nasce do histórico.
- Casos de propósito preservados (já cobertos por testes e usados na demonstração): três atrasados em graus diferentes, um inativo, um com visita marcada vencida (Doceria Jaraguá), o Armazém São Bento rebaixado por última compra no ERP, dois clientes sem `erpId`.
- Catálogo e campanhas plausíveis: nomes de produto e preços como numa tabela comercial; campanhas de Natal e Páscoa com período e produtos; metas mensais por representante compatíveis com os pedidos.
- Sem marcas de demo: `erpId` no formato de código do Senior (numérico, 5 ou 6 dígitos), sem "ERP-1001", sem nomes de teste, sem descrição "de exemplo".

**Non-goals**
- Notas fiscais importadas no seed; dados distribuídos por mês para a sazonalidade (vem com o relógio de simulação); mexer na estrutura do arquivo do seed além do necessário; schema, rotas e front.

**Anti-goals**
- Dado que pareça gerado ("Cliente 14", "Doceria Jaraguá 2"); cópias com o mesmo endereço ou telefone; CNPJ inválido; histórico que contradiz a recorrência sem ser um dos casos de propósito.

## 3. Constraints

- O mock de ERP deriva o perfil (`valorBase`, `mesesSemCompra`) por hash FNV-1a do texto do `erpId` (`providers/erp/mock/gerador.ts`); os ids atuais `ERP-10xx` foram calibrados em `config/erpIdsDemonstracao.ts`. Trocar o formato exige **recalibrar**: escolher, para cada cliente, um código numérico cujo `perfilDoErpId` dê o `mesesSemCompra` desejado (0 para os em dia, ≥3 para o Armazém rebaixado etc.). Ferramenta: um script temporário (não versionado) que varre, por exemplo, 10000–99999 e imprime os perfis.
- `erpIdDesconhecido` é "termina em -0". Um código real do Senior não termina assim, então o caso `NAO_ENCONTRADO` **sai do seed** (minha escolha: o mock continua cobrindo o caso nos testes unitários com ids próprios; os testes de integração que usavam o Empório do Chocolate como "desconhecido" passam a cobrir o caso criando o cliente no próprio teste).
- `cnpjSchema` só exige 14 dígitos, mas os CNPJs do seed devem ter dígitos verificadores válidos (o construtor gera com o algoritmo oficial; sem colidir com CNPJs reais conhecidos — usar a faixa de teste com raiz fictícia, ex.: `12.345.678/0001-xx` variando a raiz).
- Testes que contam registros ou citam clientes do seed (`tests/seed.test.ts`, `seed-importado.test.ts`, `agenda`, `clients`, `erp`, `insights`, `vendas-mensais`, `importado-erp-provider`) são ajustados sem perder os casos; a suíte do backend roda `--runInBand`.
- O seed continua relativo a `hoje` e idempotente (`semear` só acrescenta; `reiniciarDemonstracao` recria).
- Datas de calendário via `dataCalendario`/`colunaDateDaData`, como hoje.

## 4. Abordagens consideradas

1. **Escrever à mão os 13 novos (e revisar os 13 atuais) nas mesmas listas do seed** — determinístico, legível na demo, preserva a calibração do mock. **Escolhida.**
2. Gerar cópias por código com sufixo — rápido, mas aparece como dado falso na tela.
3. Fábrica com nomes e visitas sorteadas — mais código do que o problema pede, e cada seed sairia diferente.

## 5. O que fica decidido

- Distribuição 16/10 (Eduarda/Rafael), não 18/8: a carteira do Rafael deixa de parecer vazia no painel e no seletor do gestor (minha escolha).
- Cidades: só as 12 já usadas, repetidas; nomes fantasia no estilo da região (padarias, cafés, empórios, confeitarias, mercearias, casas de chá, hotéis-fazenda).
- Recorrências variadas: 15, 30, 45 e 60 dias; um ou dois clientes com 7 dias (grandes) para a agenda ter movimento diário.
- Mistura de situações igual à atual (em dia, atrasados em graus, inativo, com/sem próxima visita marcada); nenhuma cor "forçada" fora dos casos de propósito.
- `erpId` numérico de 5 dígitos para todos, exceto dois `null`; tabela `ERP_IDS_DEMONSTRACAO` recalibrada com comentário atualizado explicando o perfil escolhido de cada um.
- Catálogo: revisar nomes/preços só se algum soar artificial; sem SKU novo.
- Guia de desenvolvimento: parágrafo curto sobre a composição do seed (quantos clientes, rotas, casos de propósito) e como recalibrar `erpId` (o script temporário vira uma receita de 5 linhas no guia, não um arquivo).

## 6. O que fica para o construtor

Nomes, endereços, telefones, e-mails, contatos, descrições das visitas e pedidos (dentro dos critérios acima); a escolha dos códigos de ERP pela calibração; o ajuste dos testes citados.

## 7. Esforço

Uma tarefa de dados (grande em texto, pequena em lógica) + ajuste de testes + nota no guia: 30 a 45 min com revisão.
