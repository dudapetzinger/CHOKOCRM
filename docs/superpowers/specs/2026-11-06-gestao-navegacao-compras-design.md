# Conta Gestão, navegação com check-in em destaque, compras unificadas e horários do seed — desenho

**Data:** 2026-11-06 (aprovado em conversa; execução iniciada depois) · **Tamanho:** quatro partes pequenas/médias, uma etapa · **Status:** aprovado pelo usuário ("aprovo mas segura aí" → "pode fazer")

## 1. Intenção

Pedidos da parceira depois de usar a produção com a Etapa 12 e o seed realista:

- **A.** Trocar a conta pessoal do gestor por uma conta compartilhada **"Gestão Chokolaten"** (gestao@chokolaten.com.br, já criada em produção pelo app), usada pelo dono e pelo escritório.
- **B.** Barra de baixo com o **check-in em destaque** (botão grande e azul no centro, como o "+" do print enviado) para o representante; para o gestor, menos itens: **Importar notas** e **Usuários** saem da barra e vão para o menu da pessoa logada.
- **C.** "Sistema de verdade": a aba ERP e as sugestões não podem ignorar o que o próprio CRM sabe. Em produção (provedor importado), um cliente com visita "com venda" há 3 dias mostra "Nenhuma venda registrada" e "sem histórico de compras no ano passado", mesmo com pedido de R$ 1.284 e venda de Natal em 10/12/2025 no histórico de visitas. As compras do cliente passam a ser **notas importadas + pedidos registrados nos check-ins**.
- **D.** Datas "bagunçadas": todas as visitas do seed nascem no mesmo horário (o minuto em que o seed rodou, ex.: 20:17). Passam a ter horários comerciais variados.

## 2. Goals, non-goals, anti-goals

**Goals**
- A: seed cria/ajusta a conta `gestao@chokolaten.com.br` ("Gestão Chokolaten", GESTOR, ativa) e inativa `gestor@chokolaten.com.br` se existir; **nunca sobrescreve a senha** da conta Gestão (é uma conta real); as contas de demonstração dos representantes continuam voltando à senha de demonstração no reset. Docs, testes e textos que citam "Maicon" passam a "Gestão Chokolaten".
- B: representante vê na barra inferior Clientes, Agenda, **Check-in** (botão central elevado, primário), Painel, Campanhas; o botão abre um seletor rápido da carteira ("Para qual cliente?", busca por nome/cidade) e leva a `/clientes/:id/check-in`. Gestor vê Painel, Clientes, Agenda, Campanhas; "Importar notas" e "Usuários" ficam no menu da conta (com "Alterar senha" e "Sair"), no celular e no desktop (o menu lateral do desktop segue a mesma lista).
- C: no provedor **importado**, o histórico de compras de um cliente = notas importadas do CNPJ ∪ pedidos (`VisitItem`) das visitas com resultado VENDA **sem nota vinculada** (`erpSaleId` nulo), sem contar duas vezes. Alimenta tudo que hoje lê o provedor: cartão "Dados do ERP" (última compra, volume 90 dias, últimas vendas), insights (produtos mais comprados, variação vs ano anterior, sugestão do próximo evento), vendas mensais do painel, rebaixamento por última compra. Cada venda carrega a **origem**: "NF 2455" ou "pedido do check-in". O aviso "Nenhuma nota importada ainda." continua; o cartão deixa de dizer "Nenhuma venda registrada" quando há pedidos. No provedor **mock** nada muda.
- D: visitas do seed em horário comercial de São Paulo (8h–18h), minutos variados e determinísticos por visita; as "vendas antigas" idem.

**Non-goals**
- Integração com a API do Senior X; mudar as regras de cor; check-in pelo gestor (continua só do representante); mexer no mock.

**Anti-goals**
- Contar a mesma venda duas vezes (nota vinculada + pedido da visita); resetar a senha da conta Gestão no seed; esconder o check-in do representante atrás de mais toques do que hoje (ficha → "Novo check-in" continua existindo).

## 3. Decisões e constraints

- **A.** `USUARIOS_DEMO` no seed: `{ nome: 'Gestão Chokolaten', email: 'gestao@chokolaten.com.br', role: 'GESTOR', telefone: '(47) 3387-0000' }` no lugar de Maicon. `seedUsuarios`: para a conta Gestão, `upsert` com `update: { nome, role, ativo: true }` (sem `senhaHash`; no `create` usa a senha de demonstração); para os representantes, como hoje. Depois, `updateMany({ where: { email: 'gestor@chokolaten.com.br' }, data: { ativo: false } })` (comentário: conta de demonstração antiga). Guia §4/§9.5/§9.8: a conta Gestão mantém a senha dela no reset; o primeiro seed em um banco novo cria a conta com a senha de demonstração.
- **B.** `Moldura.tsx`: `ITENS` passa a ter a ordem e os papéis acima, sem Usuários/Importar notas; novo componente `BarraInferior` (ou o trecho equivalente dentro da Moldura) com 5 posições, a do meio = `BotaoCheckIn` (só REPRESENTANTE; para o gestor a barra tem 4 itens, sem o botão); o botão é `<button aria-label="Novo check-in">` redondo, elevado acima da barra, cor primária, ícone `Plus`, rótulo "Check-in" abaixo. Toque → painel inferior (`Sheet`/`Dialog` do shadcn já usado no projeto) "Para qual cliente?" com campo de busca (nome fantasia ou cidade, sem acento) e a lista da carteira do representante (`useClientesDaCarteira`), só ativos, ordenada por nome; escolher navega para `/clientes/:id/check-in`. `MenuDaConta`: para GESTOR, itens "Importar notas" (`/importacoes`) e "Usuários" (`/usuarios`) antes de "Alterar senha". Títulos das telas (`TITULOS`) inalterados.
- **C.** Implementado no `ImportadoErpProvider` (único ponto que o `erp.service` consome, então insights, vendas mensais, KPIs e cartão ficam consistentes sem tocar nos chamadores): além de `listarNotasDoCnpj`, busca o cliente pelo CNPJ e as visitas VENDA sem `erpSaleId` com itens (repositório novo `compras-visita.repository.ts` ou função em `visit.repository`), converte cada visita em `Sale { data: dataHora, valor: total dos itens, produtos: [{ sku, nome, quantidade }], origem: { tipo: 'pedido', visitaId } }` e cada nota em `origem: { tipo: 'nota', numero }`; mescla e ordena por data desc; `getSales`/`getPurchaseVolume`/`getLastSale`/`getRecentSales` usam a lista mesclada. `Sale.origem` é opcional no tipo (mock não preenche). `VendaDTO` expõe `origem`. Front: no cartão "Últimas vendas", cada item mostra a data, o valor, os itens e a origem ("NF 2455" / "Pedido do check-in"); "Última venda" e volume vêm do backend já mesclado. Textos: "Pedido do check-in", "NF <número>".
- **D.** `seedVisitas`: `dataHora = inicioDoDia(dataCalendario(diasAtras(n)))` + hora `8 + (i × 3) % 10` e minuto `(i × 17) % 60`, com `i` = índice da visita no cliente somado ao índice do cliente (determinístico); as mesmas visitas continuam caindo nos mesmos dias (a regra de intervalo e os testes de cor não mudam). Visitas "hoje" ficam com hora ≤ 18h (nunca no futuro: se a hora calculada for maior que a hora atual em SP no dia de hoje, usar 8h).
- Testes: seed (conta Gestão: existe, GESTOR, ativa; conta antiga inativada; senha da Gestão preservada quando já existia; horários entre 8h e 18h SP, não todos iguais; nenhuma visita no futuro); provider importado (visita VENDA sem nota entra no histórico com origem `pedido`; visita com nota vinculada não duplica; `getPurchaseVolume` soma os dois; insights com pedido do ano passado geram sugestão; vendas mensais somam pedidos); front (barra do representante com "Check-in" no centro, seletor com busca e navegação; barra do gestor com 4 itens; menu da conta do gestor com os dois itens; cartão com origem).
- Docs: guia (§4 seed: conta Gestão e horários; §9.5/§9.8 senha da Gestão), especificação técnica (navegação, menu da conta, histórico unificado, `Sale.origem`), casos de uso (UC07 check-in pelo botão central; UC11 compras unificadas; ator Gestão), arquitetura (provider importado lê notas e pedidos), README (conta Gestão nas credenciais de demonstração). Todos os "Maicon Krüger"/"gestor@chokolaten.com.br" dos docs e testes viram "Gestão Chokolaten"/"gestao@chokolaten.com.br".
- Deploy: sem migration; pedir "Atualizar" no PWA; `db:seed:reset -- --confirmar` em produção para a conta Gestão e os horários; conferir que gestao@ continua com a senha do escritório.

## 4. Abordagens consideradas (C)

1. **Mesclar no `ImportadoErpProvider`** — escolhida: um ponto só, todos os consumidores ficam coerentes, sem mudar `erp.service` nem os chamadores.
2. Mesclar no `erp.service` (acima do provider) — espalharia a mescla por `consultarVendas`, `consultarEmLote`, `obterDadosErp`; mais pontos para errar.
3. Serviço novo "histórico de compras" consumido por cada tela — reescreveria insights, vendas mensais e KPIs; fora de proporção.

## 5. O que fica para o construtor

Nomes internos; o visual exato do botão central dentro do padrão da barra (sombra, tamanho ~56 px, safe-area); a implementação do seletor (reusar a lista/busca existente se houver); o mapeamento `quantidade` inteiro dos itens; a ordem dos itens do menu da conta.

## 6. Esforço

T1 seed (A + D), T2 provider unificado (C backend), T3 cartão com origem (C front), T4 barra inferior com check-in, T5 menu da conta + docs. ~3 h com revisões, commits faseados.
