# Importação em modal com cliente vinculado, ranking em destaque, agenda de visitas marcadas e CRM completo — desenho

**Data:** 2026-11-12 · **Tamanho:** uma rodada (5 tarefas) · **Status:** para aprovação (checagem do construtor feita)

## 1. Intenção

Depois de usar a importação em produção, a parceira pediu, nas palavras dela:

- "ao carregar o arquivo da nota fiscal, quero que abra um modal com as infos do cliente e produtos listados para confirmação (…) se faz o carregamento, se cancela e depois se quer uma nova importação"; a nota do Don Giacomo "consta em CNPJs sem cliente, não entendi por quê"; "Copiar CNPJ (…) nada a ver a utilidade". Decisão em conversa: o modal cria o cliente na hora, "já vinculando o cliente e CNPJ".
- Gestão: "ranking dos representantes, achei pouco destaque para os temas 'visitas', 'conversão em vendas', 'receita'"; "agenda do dia, remova aquela mensagem de explicação das cores e prioridades".
- "TODO DIA até dia 04/12 tenha pelo menos 2 visitas agendadas para testar a funcionalidade do MAPS; em modo demonstração, da mesma forma, já que tudo atualiza junto".
- "revise as informações para que os dados fiquem organizados como um CRM completo e bem gerido pelos reps e gestão, um CRM perfeito para a apresentação, com campos preenchidos, visitas, dados de ERP etc."

Estado de hoje: a conferência da importação é uma lista dentro do cartão da página; uma nota de CNPJ sem cliente entra "só no ERP" e vai para o bloco "CNPJs sem cliente no CRM", onde o gestor cria o cliente (`CriarClientePelaNota`, que vincula as notas do CNPJ ao cliente novo) ou copia o CNPJ. O ranking usa títulos miúdos (`text-xs`, cinza, caixa alta). A agenda tem um parágrafo fixo explicando cores e prioridades (`AgendaPage.tsx:226-228`). O seed marca só 3 próximas visitas (`PROXIMAS_VISITAS_DEMO`); cada cliente tem uma única `proximaVisita`; o roteiro do Maps monta a rota pelos endereços (`lib/roteiro.ts`), sem geocodificação.

## 2. Goals, non-goals, anti-goals

**Goals**
- **Conferência em modal:** ao "Ler notas", abre um diálogo com as notas lidas (cliente ou "Sem cliente no CRM", data, total, produtos), "Confirmar importação" e "Cancelar"; depois da gravação, o mesmo diálogo mostra "Importação concluída." com o resumo, e para cada CNPJ sem cliente um formulário "Criar cliente" (representante, nome fantasia, recorrência) que cria o cliente e vincula as notas do CNPJ a ele; "Ver cliente"/"Ver {nome}" e "Nova importação" (fecha o diálogo com a tela limpa). "Copiar CNPJ" some. O bloco "CNPJs sem cliente no CRM" continua só para notas antigas, apenas com "Criar cliente".
- **Ranking com destaque:** cada lista vira um cartão com cabeçalho grande (ícone + título em `text-base font-semibold`), o 1º colocado destacado (barra na cor primária e posição em medalha), os demais como hoje.
- **Agenda sem o parágrafo** das cores e prioridades.
- **Agenda de visitas marcadas:** para cada representante, 2 clientes com `proximaVisita` em cada dia útil de `hoje` até `hoje + 23 dias` (hoje 11/11 → 04/12; no modo demonstração, a mesma janela a partir da data simulada), escolhidos entre os que a recorrência já prevê para aquele dia (ver §3.1) e fora dos casos de propósito; os três casos de propósito atuais continuam (Doceria Jaraguá vencida −2, Café Blumenau +2, Empório do Vale Brusque +3 com campanha). Todos com endereço completo (o roteiro do Maps usa o endereço).
- **CRM completo:** o seed não deixa tela vazia nem campo em branco onde um CRM bem gerido teria dado: ver a lista em §3.

**Non-goals**
- Editar os dados lidos no modal; geocodificar endereços; fotos nas visitas do seed (exigem arquivos no storage); mudar as regras de vínculo nota × visita; mudar o cálculo do ranking.

**Anti-goals**
- Nota de CNPJ sem cliente ficar invisível ou exigir outra tela para virar cliente; visita marcada em fim de semana; cliente marcado duas vezes no mesmo dia; o reset da demonstração deixar de ter as visitas marcadas; dados que pareçam gerados.

## 3. Decisões e constraints

**Modal de conferência (T2, front).** `ImportacoesPage` mantém os estados (escolher → conferir → concluída), mas "conferir" e "concluída" vivem num diálogo modal. O projeto não tem `Dialog`/`Sheet` do shadcn: o padrão existente é o painel do check-in (`SeletorDeClienteParaCheckIn`: `role="dialog"` + `aria-modal`, portal em `document.body`, fundo escurecido, Esc/"Fechar"/toque no fundo fecham, Tab circula dentro). Extrair esse comportamento para `components/crm/Dialogo.tsx` (props: `titulo`, `aberto`, `aoFechar`, `children`, `rodape?`; em telas estreitas ocupa a largura toda com rolagem interna; centrado a partir de `sm`) e usar nos dois (o seletor do check-in passa a usá-lo sem mudar de comportamento nem de testes). Textos atuais mantidos ("Notas lidas", "Já importada · será atualizada", "Confirmar importação", "Cancelar", "Importando…", "Importação concluída.", "Deseja verificar?", "Ver cliente", "Ver {nomeFantasia}", "Nova importação"). Na conferência, a nota sem cliente mostra "Sem cliente no CRM · será criado ao concluir" (só informativo). Na conclusão, para cada CNPJ sem cliente das notas gravadas, um bloco "Criar cliente para {razão social} · {CNPJ}" com o formulário de `CriarClientePelaNota` (representante obrigatório; nome fantasia pré-preenchido; recorrência 15) e, ao salvar, toast `Cliente criado na carteira de {representante}` e o link "Ver {nomeFantasia}" aparece no lugar do formulário; o resumo não muda. "Nova importação" e o "X" do diálogo voltam ao estado "escolher" limpo (depois de gravar, as listas já foram invalidadas). "Cancelar" na conferência fecha sem gravar. O backend não muda: `POST /erp/importacoes` grava `SEM_CLIENTE`; `POST /erp/sem-cliente/:cnpj/cliente` cria o cliente e vincula as notas (como hoje). `ConferenciaDeNotas` e `ImportacaoConcluida` continuam como componentes, renderizados dentro do diálogo; `ImportacaoConcluida` ganha a prop com os CNPJs sem cliente da importação e usa `CriarClientePelaNota`. Foco: ao abrir, no título do diálogo; ao fechar, no input de arquivos. Bloco "CNPJs sem cliente no CRM": remove o botão "Copiar CNPJ" e o texto que o cita.

**Ranking (T3, front).** `Ranking.tsx`: cada lista em um `Cartao` próprio com cabeçalho `h3` em `text-base font-semibold` e ícone (`lucide`: `CalendarCheck` para visitas, `Target` para conversão, `Banknote` para receita); o 1º colocado com a barra em `bg-primary`, a posição em um círculo preenchido ("1º") e o valor em `font-semibold`; os demais como hoje. Mesmas listas, mesma ordenação, mesmos `aria-label`. Em telas largas os três cartões ficam lado a lado como hoje.

**Agenda (T3, front).** Apagar o parágrafo explicativo (`AgendaPage.tsx:224-229`) e o teste que o espera; nada mais muda.

**Visitas marcadas (T1, back).** Em `seed/demonstracao.ts`, `seedProximasVisitas` passa a: (1) aplicar `PROXIMAS_VISITAS_DEMO` como hoje; (2) para cada representante e cada dia útil `d` de `hoje` a `hoje + 23` (inclusive), escolher 2 clientes ativos da carteira cuja cidade cai naquele dia da semana (`rotas.ts`), sem `proximaVisita`, fora dos casos de propósito e nunca visitados (`Padaria Confeitaria Indaial`) e dos inativos; determinístico (ordem fixa por nome, com deslocamento pelo índice do dia); se faltar candidato na rota do dia, completar com qualquer cliente da carteira sem `proximaVisita`; nunca o mesmo cliente duas vezes; `proximaCampanhaId` só no caso do Empório do Vale Brusque, como hoje. 18 dias úteis × 2 = 36 clientes por representante: cabe nos ~40 de cada carteira. Idempotente (`updateMany` com `proximaVisita: null`). Testes de propriedade: para cada representante, cada dia útil da janela tem ≥ 2 clientes com `proximaVisita` nesse dia; nenhum em sábado/domingo (fora os casos de propósito); nenhum cliente com duas marcações; a agenda do representante (`GET /agenda`) devolve ≥ 2 itens "hoje"; determinismo com o mesmo `hoje`; com a data de demonstração, a janela acompanha.

**CRM completo (T4, back: auditoria do seed).** Lista do que o seed garante, com teste de propriedade para cada item:
- Clientes (80): `email` preenchido (no domínio do cliente), `telefone`, `endereco`, `cidade`, `erpId` em todos os ativos (os âncoras sem `erpId` recebem um calibrado com `mesesSemCompra ≤ 2`, exceto o nunca visitado), 1 ou 2 contatos com nome, cargo e telefone, um principal.
- Visitas: toda visita com `descricao` não vazia; toda VENDA com pedido de 1–4 itens; nenhuma no futuro.
- Lembretes: cada representante com ≥ 3 abertos (um vencido) e ≥ 1 concluído, textos coerentes.
- Mensagens de estoque: 3 por representante nas últimas 4 semanas (clientes com `erpId`), com o texto montado pelo mesmo template da regra real (`stock-message.template.ts`, a partir dos dados do ERP simulado do cliente) e `criadoEm` em horário comercial de um dia útil, para a aba "Mensagens geradas" e a taxa de registro não ficarem vazias.
- Metas: do mês de `hoje` e do mês seguinte, para cada representante.
- Campanhas: a do mês em andamento e a próxima, com descrição, período e produtos.
- Usuários: os três com `telefone`.
- Painel da gestão: 30/90/365 dias com dados; "Quem está visitando pouco?" com conteúdo; alertas de produção com ≥ 1 alerta no horizonte de 90 dias (evento sazonal no horizonte + clientes com estoque baixo no mock).
Depois do seed: um `describe` em `tests/seed.test.ts` (ou arquivo novo `tests/seed-crm-completo.test.ts`) com essas propriedades. Onde o dado já existe, o teste só prova; onde falta, o seed passa a gerar.

**Docs e deploy (T5).** Guia §4 (seed: visitas marcadas e auditoria), casos de uso (UC28 modal e criação do cliente na importação; agenda sem o parágrafo), especificação (seed), README (importação). Deploy sem migration nem variável: depois dele, recriar a demonstração pela tela de login (as visitas marcadas vêm do seed) e "Atualizar" no PWA.

### 3.1 Decisões depois da checagem do construtor (minhas chamadas)

1. **Marcar no dia em que a recorrência já cai.** A agenda do dia (e o roteiro do Maps, que parte dela) já tem 4–6 clientes por dia útil pela recorrência; o que fica vazio é o **calendário**, que só mostra visitas marcadas. Uma visita marcada substitui a recorrência na agenda (`agenda.montagem.ts:116-122`), então marcar um cliente para outro dia o tiraria do "hoje". Regra: para cada representante e cada dia útil da janela, escolher 2 clientes **entre os que a recorrência já prevê para aquele dia** (a agenda absoluta de `rotas.ts`/`gerador-visitas.ts`), ainda sem `proximaVisita`, fora dos casos de propósito e dos inativos; só se faltar candidato previsto no dia, completar com um cliente da rota daquele dia da semana sem marcação. Assim a agenda do dia e os testes de 4–6/dia, cores e "cada cliente uma vez" não mudam, e o calendário ganha ≥ 2 marcações por dia útil.
2. **Caso de propósito em fim de semana:** `Empório do Vale Brusque +3` passa a "+3, ou o próximo dia útil se cair em fim de semana" (idem Café Blumenau +2). A Doceria Jaraguá (−2, vencida) fica como está.
3. **Testes de agenda "hoje" ≥ 2** só com data de demonstração fixada num dia útil (o helper já faz isso).
4. **Modal:** padrão manual (`Dialogo.tsx`, §3), sem dependência nova. `CriarClientePelaNota` ganha a prop `aoCriar(cliente: { id: string; nomeFantasia: string })` e passa a aceitar `Pick<CnpjSemCliente, 'cnpj' | 'razaoSocial'>` (o formulário só usa esses dois); `ImportacaoConcluida` guarda em estado local os clientes criados e troca o formulário pelo link "Ver {nomeFantasia}"; o texto antigo "Criar o cliente no bloco…" e a âncora saem da conclusão. Esc/"X"/fundo ficam bloqueados enquanto `ocupado` (lendo ou gravando).
5. **Mensagens de estoque no seed:** gravadas direto na transação (`tx.stockMessage.create`) com o texto de `montarMensagemDeEstoque` (`stock-message.template.ts`) a partir dos dados do ERP simulado do cliente (`erpProvider`, que no híbrido cai no mock para clientes sem nota) e `eventoSazonalId` do evento vigente na data (`eventoVigente` com `tx`); `dataGeracao` em dia útil e horário comercial nas últimas 4 semanas; clientes: os 3 de cada representante com venda mais recente e `erpId`.
6. **`erpId` nos dois âncoras sem ERP** (Padaria Vale Europeu e Confeitaria Rota das Cachoeiras, o caso `SEM_ERP_ID` da demonstração): o "CRM perfeito" vence; recebem `erpId` calibrado (`mesesSemCompra ≤ 2`) e os testes que exigiam os dois sem ERP (`seed.test.ts:541-555`) passam a exigir todos com ERP, exceto nenhum. A tela "Sem histórico de compras para este cliente." continua existindo para clientes criados à mão.
7. **Lembretes e metas:** `LEMBRETES_DEMO` cresce para ≥ 3 abertos (um vencido) e 1 concluído **por representante** (textos coerentes com a última visita, como hoje); `seedMetas` grava também o mês seguinte (mesma fórmula). Os testes que contavam 4 lembretes, 3 próximas visitas e `totais()` são atualizados.
8. **Ranking:** cada lista num `section` próprio com visual de cartão (`rounded-lg border bg-card p-4`), `h3` com ícone, sem usar `Cartao` (que fixa `h2`); os `aria-label` das `ol` ficam.
9. **Agenda:** só o parágrafo de `AgendaPage.tsx:224-229` sai (o da aba do calendário fica); o teste que o cita é localizado por grep.
10. **Teste das próximas visitas** (`seed.test.ts:~816`) reescrito para datas relativas a `hoje`.

## 4. Abordagens consideradas

- Criar o cliente **antes** de gravar (endpoint novo com os dados do destinatário lidos) × **depois** de gravar, no mesmo modal, reaproveitando `POST /erp/sem-cliente/:cnpj/cliente` (escolhida: zero backend novo, resultado idêntico para quem usa — a nota sai do modal já vinculada).
- Visitas marcadas: lista à mão (inviável para 72 marcações que mudam com `hoje`) × geração por rota e dia útil (escolhida).
- Auditoria do CRM: conferir tela a tela no navegador (não repetível) × propriedades em teste sobre o seed (escolhida; a conferência visual fica para o fecho da rodada).

## 5. O que fica para o construtor

Visual exato do diálogo e dos cartões do ranking (dentro dos textos e classes acima); escolha dos clientes por dia (a ordem determinística); textos das mensagens de estoque do seed (pela regra real de geração); nomes dos testes.

## 6. Esforço

T1 visitas marcadas 35 min · T2 modal 50 min · T3 ranking + agenda 25 min · T4 CRM completo 45 min · T5 docs/deploy 20 min · revisão final 25 min.
