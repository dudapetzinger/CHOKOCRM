# Modo demonstração, seed "últimos 3 meses", Importar notas em destaque e senhas sem e-mail — desenho

**Data:** 2026-11-09 · **Tamanho:** uma etapa (6 tarefas) · **Status:** aprovado em conversa (09/11)

## 1. Intenção

A parceira decidiu que, até a apresentação, **tudo no app é demonstração**: clientes, visitas, pedidos e ERP vêm do seed e do ERP simulado (a integração com o Senior X fica para depois; a importação de DANFEs continua como função, não como fonte dos dados). Pediu:

- **Modo demonstração** acessível **no topo da tela de login**: escolher uma data, e o app passa a viver nela, com a demonstração recriada em volta da data (sugestões e alertas seguindo a sazonalidade da época). A data fica guardada até ser trocada ou até "voltar ao real".
- **Seed como se o sistema rodasse há 3 meses**, organizado: visitas de segunda a sexta para cada representante, 4 a 6 por dia, agrupadas por cidade na rota do dia, recorrências batendo com o histórico, anotações realistas por cliente e época, pedidos coerentes, campanhas e metas do mês.
- **Gestão com um botão em destaque** na barra inferior, como o Check-in do representante: **Importar notas**.
- **Senhas**: nada de redefinição por e-mail; quem esquece pede ao gestor uma **senha provisória** e troca no perfil (que já exige a senha atual).

## 2. Goals, non-goals, anti-goals

**Goals**
- Produção com `ERP_PROVIDER=mock` (o ERP simulado é a fonte de vendas/estoque/sugestões; os pedidos dos check-ins do seed aparecem no histórico de visitas; a importação de DANFEs segue funcional).
- A data de demonstração deixa de ser variável de ambiente e passa a **configuração no banco**, trocável pela tela sem reiniciar; o relógio (`agora()`) continua a única fonte de "hoje"; `GET /sistema/relogio` passa a ser público (a tela de login mostra o estado).
- Botão **"Modo demonstração"** no topo da tela de login (todos veem): abre um painel com a data (ou "Voltar ao real"), o aviso do que será apagado e o campo **senha da conta Gestão**; confirmar grava a data e recria a demonstração em volta dela, numa transação; a faixa **"Modo demonstração · dd/mm/aaaa"** aparece em todas as telas (login inclusive) enquanto houver data.
- Seed gerado a partir de `hoje`: 13 semanas de histórico, rotas por dia da semana, 4–6 visitas por dia útil por representante, resultados e pedidos plausíveis e determinísticos, anotações por situação e estação, próximas visitas, lembretes, campanhas e metas coerentes com o mês; os casos de propósito (quatro cores presentes, um inativo, Armazém rebaixado pelo ERP, uma visita marcada vencida) continuam.
- Barra da Gestão: Painel, Clientes, **[Importar notas]** (botão central elevado), Agenda, Campanhas; "Usuários" segue no menu da conta; "Importar notas" sai do menu da conta (está na barra) e fica como item normal no menu lateral do desktop.
- Senhas: remover a redefinição por e-mail (botão do gestor, rota pública, página, token, provedor de e-mail e variáveis SMTP); incluir **"Definir senha provisória"** na tela de Usuários (gestor; só para contas que não a dele? pode para qualquer conta, inclusive a própria).

**Non-goals**
- Integração com o Senior X; modo demonstração por usuário; trocar o provedor em tempo de execução; manter dados reais ao recriar a demonstração (tudo é demonstração; contas são mantidas, como hoje).

**Anti-goals**
- Alguém que abre o link do app recriar a demonstração sem a senha da Gestão; duas fontes de "hoje" (env e banco) em conflito; seed com visitas em fim de semana ou fora do horário comercial; dados que pareçam gerados ("Cliente 7", textos repetidos em sequência).

## 3. Decisões e constraints

**Relógio no banco (T3).** Tabela `configuracoes` com uma linha (`chave 'demonstracao'`): `data_simulada DATE?`, `dia_de_referencia DATE?`, `atualizado_em`, `atualizado_por` (userId?). `lib/relogio.ts`: o deslocamento em dias vem da configuração, carregado na subida (`carregarRelogio()` em `server.ts` antes de escutar) e atualizado em memória por `definirDemonstracao(data | null)`; `agora()` continua síncrono. Semântica igual à âncora atual: `deslocamento = diasEntre(dia_de_referencia, data_simulada)`, com `dia_de_referencia` = dia real em que a data foi definida (gravado junto). Sem linha → deslocamento 0. A variável `DATA_DE_DEMONSTRACAO` **sai** (env, `.env.example`, docs, testes); o helper de teste passa a gravar a configuração. `GET /sistema/relogio` fica público e devolve `{ agora, simulado, dataDeDemonstracao, diaDeReferencia, deslocamentoDias }`. Faixa: texto `Modo demonstração · dd/mm/aaaa` (substitui "Data simulada: …"), também na tela de login.

**Recriar a demonstração (T3 + T5).** `POST /sistema/demonstracao` público, corpo `{ data: 'AAAA-MM-DD' | null, email, senha }`: autentica `email`/`senha` e exige `role GESTOR` ativo (401 `E-mail ou senha inválidos`, 403 se não for gestor); grava a configuração (ou limpa, com `null`) e chama `reiniciarDemonstracao(prisma, agora())` (o reset já mantém as contas); responde `{ relogio }`. Operação única por vez (mutex em memória; 409 `Já existe uma recriação em andamento.`). Log na subida: `Modo demonstração: dd/mm/aaaa (+N dias)` quando há data.

**Tela de login (T5).** No topo, botão discreto **"Modo demonstração"** (ou, quando ativo, a faixa com "alterar"). Painel: campo de data (padrão: data atual simulada ou hoje), opção "Voltar ao real", texto de aviso: `Isto apaga clientes, contatos, visitas, pedidos, lembretes, campanhas e metas e recria a demonstração nessa data. As contas de acesso são mantidas.`, campo "Senha da conta Gestão" (o e-mail fixo `gestao@chokolaten.com.br`, vindo do `GET /sistema/relogio`? não: a tela conhece o e-mail como constante pública do produto), botões "Aplicar"/"Cancelar"; durante a chamada: "Recriando a demonstração…"; sucesso: toast `Demonstração recriada em dd/mm/aaaa` (ou `Modo demonstração desligado`) e recarregar o relógio; erro 401/403/409 inline. Depois do login, a faixa existente mostra o estado.

**Seed "últimos 3 meses" (T4).** `seed/demonstracao.ts` passa a gerar as visitas (em vez de listar): 
- Rotas: cada representante tem um mapa dia-da-semana → cidades (Eduarda: seg Joinville, ter Jaraguá do Sul, qua Pomerode+Corupá, qui São Bento do Sul, sex Joinville/Jaraguá; Rafael: seg Blumenau, ter Indaial+Timbó, qua Brusque, qui Itajaí, sex Rio do Sul/Blumenau). Cada cliente tem o seu dia da semana (pela cidade) e a recorrência (7, 14, 21, 28 ou 42 dias; múltiplos de 7 para cair sempre no mesmo dia da semana).
- Para cada dia útil das 13 semanas anteriores a `hoje` (inclusive a semana corrente até hoje), os clientes daquele dia cuja recorrência "vence" são visitados; completar até 4–6 visitas/dia com clientes do mesmo dia (visita extra de acompanhamento) ou deixar 4 se não houver; nunca mais de 6; horários sequenciais entre 8h e 17h (intervalos de 60–90 min, determinísticos).
- Resultado por visita: VENDA ~55 %, NEGOCIACAO ~25 %, SEM_VENDA ~20 %, com PRNG determinístico (semente = cliente + data); pedidos de 1 a 4 itens do `CATALOGO`, quantidades plausíveis por tipo de cliente (padaria compra mais tabletes, hotel compra caixas…), com produtos sazonais no mês (Natal em nov/dez, Páscoa em fev/mar/abr, Dia das Mães em abr/mai, Namorados em mai/jun, inverno jun/jul/ago, Oktoberfest set/out).
- Anotações: banco de frases por situação (venda, negociação, sem venda) × estação × tipo de cliente, combinadas sem repetir a mesma frase duas vezes seguidas no mesmo cliente; menciona o contato pelo nome e cargo.
- Casos de propósito: Padaria Confeitaria Indaial nunca visitada; Café Beira-Rio inativo (visitas até 7 semanas atrás); três clientes atrasados (última visita pulada: 1, 2 e 3 recorrências); Armazém São Bento com visita recente e `erpId` rebaixado; Doceria Jaraguá com próxima visita marcada vencida; três próximas visitas marcadas; quatro lembretes (textos coerentes com a última visita).
- Campanhas: a sazonal do mês de `hoje` em andamento e a próxima agendada (nomes com o ano); metas mensais por representante compatíveis com o ritmo gerado (vendas ≈ 1,1× a média mensal gerada; visitas ≈ dias úteis × 5).
- Testes: propriedades em vez de contagens fixas (cada dia útil das 13 semanas tem 4–6 visitas por representante; nenhuma em sábado/domingo nem fora de 8h–17h; intervalos por cliente ≈ recorrência ±3 dias salvo casos de propósito; quatro cores; nenhum texto repetido em sequência no mesmo cliente; determinismo: dois seeds com o mesmo `hoje` geram as mesmas visitas).

**Barra da Gestão (T2).** `Moldura`: gestor → Painel, Clientes, [Importar notas central, `aria-label="Importar notas"`, ícone `FileUp`], Agenda, Campanhas; o botão navega para `/importacoes`. Menu da conta do gestor: só "Usuários" (+ Alterar senha, Sair). Desktop: menu lateral do gestor com Importar notas como item normal (quinto). Padding do `<main>` do gestor como o do representante (botão elevado).

**Senhas (T1).** Remover: rota `POST /auth/redefinir-senha`, `POST /users/:id/redefinicao-de-senha`, `RedefinirSenhaPage` e rota `/redefinir-senha`, botão "Redefinir senha" da tela de Usuários, `PasswordResetToken` (migration `DROP TABLE`), `providers/email/*`, `email.templates.ts`, `redefinicao-senha.regras.ts`, variáveis `SMTP_*`/`EMAIL_FROM`/`APP_URL` (se só serviam ao e-mail) do `env.ts`, `.env.example`, docs. Incluir: `PUT /users/:id/senha { senha }` (GESTOR, `requireRoleAtual`, `senhaSchema`), que grava o hash; UI em Usuários: item "Definir senha provisória" → diálogo com "Nova senha" e "Confirmar", toast `Senha provisória definida. Peça para a pessoa trocá-la no perfil.`. Sessões ativas da pessoa continuam (não há revogação de JWT; documentar).

**Produção (T6).** `ERP_PROVIDER=mock` no App Service (o usuário troca); remover `DATA_DE_DEMONSTRACAO` e `SMTP_*` das configurações; deploy com 2 migrations (`configuracoes`, drop `password_reset_tokens`); depois, usar o próprio "Modo demonstração" da tela de login para recriar a demonstração (substitui o seed reset por SSH nesse fluxo; o comando continua existindo).

## 4. Abordagens consideradas

- Modo demonstração: (1) **configuração no banco + reset pela tela** — escolhida; (2) variável de ambiente + reset por SSH (atual) — exige reinício e acesso ao Azure a cada troca; (3) só deslocar o relógio sem recriar — os dados envelhecem.
- Seed: (1) **gerador por rotas e recorrência** — escolhido (3 meses organizados, determinístico); (2) listar 300+ visitas à mão — inviável de manter.
- Senhas: (1) **senha provisória pelo gestor** — escolhida; (2) manter e-mail — a parceira não quer SMTP.

## 5. O que fica para o construtor

Nomes internos; o visual do botão no login e do painel; as frases do banco de anotações (dentro dos critérios); a distribuição exata dos clientes por dia e os ajustes finos para as quatro cores aparecerem em qualquer `hoje`; a forma do mutex; o helper de testes que grava a configuração do relógio.

## 6. Esforço

T1 senhas (back+front) 35 min · T2 barra da Gestão 20 min · T3 relógio no banco + endpoints + faixa 45 min · T4 seed gerador 60 min · T5 tela de login 35 min · T6 docs/produção 20 min · revisão final 25 min.
