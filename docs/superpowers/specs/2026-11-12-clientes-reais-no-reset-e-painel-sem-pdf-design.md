# Clientes reais sobrevivem à recriação da demonstração; painel sem "PDF" — desenho (mudança pequena)

**Data:** 2026-11-12 · **Tamanho:** rodada curta (2 tarefas) · **Status:** aprovado em conversa ("ótimo pode fazer")

## Intenção

A parceira importou em modo demonstração a nota do cliente Le Vine, criou o cliente pela importação e viu-o na carteira do representante; ao "Voltar ao real", o cliente sumiu e a nota voltou para "CNPJs sem cliente no CRM". Isso é o comportamento atual (a recriação apaga todos os clientes), mas um cliente real criado à mão ou pela nota não deve depender da demonstração. Também: o botão "PDF" do painel chama `window.print()`, que no app instalado não abre nada; sai, e "Planilha" vai para a linha do seletor de período.

## Goals / non-goals / anti-goals

- **Goal 1 — clientes reais sobrevivem ao reset.** `reiniciarDemonstracao` apaga e recria só os **clientes da demonstração** (CNPJ em `CLIENTES_ANCORA ∪ CLIENTES_GERADOS`); os demais clientes (criados pela nota ou à mão) ficam, com contatos, visitas (itens, fotos, alterações de agenda), lembretes, mensagens de estoque e as notas vinculadas. Metas e campanhas continuam sendo apagadas e recriadas (são da demonstração); visitas e `proximaCampanhaId` dos clientes mantidos ficam com a campanha nula (`onDelete: SetNull`, já existente).
- **Goal 2 — painel:** remover "PDF" (botão, `window.print`, textos e testes); "Planilha" fica ao lado do seletor de período, na mesma linha em telas médias e largas, e numa linha própria no celular, ocupando o mínimo.
- **Non-goals:** marcar clientes com uma flag de origem (a lista de CNPJs do seed já define quem é demonstração); mudar o que a recriação faz com notas, contas e configurações.
- **Anti-goals:** o reset apagar um cliente real; o reset deixar lixo de um cliente da demonstração (visita órfã, contato órfão); uma nota de cliente real voltar a "sem cliente".

## Decisões

- **Reset (T1, back):** em `reiniciarDemonstracao`, calcular `cnpjsDaDemonstracao = new Set(CLIENTES.map(c => c.cnpj))` e `idsDemo = clientes com cnpj in …`; apagar `visitItem`/`visit`/`stockMessage`/`visitScheduleChange`/`contact`/`reminder` só `where: { clientId: in idsDemo }` (ou pela visita desses clientes), depois `client.deleteMany({ where: { id: in idsDemo } })`; `goal.deleteMany()` e `campaign.deleteMany()` continuam globais; a limpeza das notas (`AUTOMATICO/VINCULADA/PENDENTE → SEM_VISITA`) passa a valer só para notas cujo `clientId` está em `idsDemo` ou é nulo (as notas de clientes mantidos continuam vinculadas às suas visitas, que não são apagadas); `religarNotasOrfas` inalterado. Um cliente real com o mesmo CNPJ de um cliente do seed não existe (CNPJ é único). Testes em `tests/seed.test.ts` (ou `seed-reais.test.ts`): cliente criado à mão com contato, visita com itens e lembrete → sobrevive ao reset com tudo; nota importada e cliente criado pela nota → depois do reset o cliente continua, a nota continua `clientId` dele e `VINCULADA`/`SEM_VISITA` como estava, e não aparece em "CNPJs sem cliente"; os 80 da demonstração são recriados; `totais()` iguais; um cliente da demonstração editado à mão continua sendo apagado (é da demonstração).
- **Painel (T2, front):** `PainelPage.tsx` — `BotoesDeExportar` vira só "Planilha" (mesma geração, mesmo toast), renderizado na linha do seletor "Período" (`md:` lado a lado à direita; `max-md:` abaixo, largura total); apagar `aria-label="PDF da aba aberta"`, `window.print`, o `print:hidden`/comentários só do PDF que ficarem sem uso (os estilos de impressão das abas podem ficar); testes do painel sem "PDF". Docs: casos de uso/README/guia onde citam "PDF" do painel.

## Esforço

T1 30 min · T2 15 min · revisão final 15 min.
