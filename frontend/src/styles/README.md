# Estilos do ChokoCRM

CSS escrito à mão, sem framework. Mobile-first: a base é o celular (largura de
referência 390 px) e o desktop (≥ 768 px) vem por cima.

**Em migração (Etapa 8, revisão pelo protótipo Lovable):** a base nova é
Tailwind 4 + shadcn, em `src/styles.css` e `src/components/{ui,crm}/`. A
moldura (menu lateral, barra superior, navegação inferior, menu da conta) já é
a nova (`components/crm/Moldura.tsx`); as telas ainda não migradas continuam
com este CSS, dentro da `.container`, e saem daqui uma a uma. As regras de
elemento (h1–h3, `p`, campos) valem só dentro da `.container`, para não
vazarem para a interface nova.

## Ordem de import

`main.tsx` importa, nesta ordem:

1. as fontes `@fontsource/plus-jakarta-sans` (400, 500, 600, 700, 800), servidas pelo próprio app;
2. `src/styles.css` (Tailwind e tokens do protótipo), antes do CSS antigo: este
   não tem camada e por isso vence o preflight e as utilidades do Tailwind;
3. `global.css`, que começa com `@import` de `tokens.css`, `tipografia.css` e
   `formularios.css` (o `@import` precisa vir antes de qualquer regra);
4. `desktop.css`, por último, para vencer na cascata as regras de mesma
   especificidade do `global.css`.

## O que vive em cada arquivo

| Arquivo | Conteúdo |
|---|---|
| `tokens.css` | Variáveis em `:root`: cores, espaçamentos, raios, sombra, fontes e escala de tipografia. Única fonte de cores cruas (hex, `rgba`); a exceção é a seta do `<select>` em `formularios.css`, um SVG em data URI, que não lê variáveis CSS e repete o hex de `--texto-suave`. |
| `tipografia.css` | Fonte, tamanho e altura de linha do corpo; títulos (`h1`–`h3`, `.card-titulo`). |
| `formularios.css` | Campos (`.campo`), select compacto (`.select`), busca com lupa (`.campo-busca`), botões (`.btn-primario`, `.btn-secundario`, `.btn-terciario`, `.btn-perigo`, modificadores `.btn-bloco` e `.btn-icone`), controle segmentado (`.segmentado`, `.segmentado-compacto`), área de texto. |
| `global.css` | Base e componentes do celular, em seções numeradas (cartões, listas, ficha, agenda, painel...); as da moldura antiga (barra superior, login, navegação inferior) saíram na Etapa 8. |
| `desktop.css` | Tudo de ≥ 768 px: largura da `.container`, duas colunas, ajustes de 1024 e 1200. |

## Tokens semânticos

Nas regras dos componentes, use estes nomes em vez de hex ou das cores da marca.

| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#f8f6f4` | fundo da página (o mesmo `--background` da moldura nova) |
| `--superficie` | `#ffffff` | cartões, listas, barra superior, navegação |
| `--superficie-suave` | `#f8f9fb` | hover de linha, estado vazio |
| `--borda` | `#e3e6ea` | borda de cartões, listas, campos, divisórias |
| `--borda-forte` | `#c9ced6` | contorno de controle, botão secundário |
| `--texto` | `#1f2328` | texto principal |
| `--texto-suave` | `#5f6b7a` | texto secundário |
| `--texto-fraco` | `#8a94a3` | terciário, só em 13 px+ e nunca como único sinal |
| `--marca` | `--marrom-900` | logotipo, item ativo da navegação, link forte |
| `--acao` / `--acao-hover` | `--marrom-900` / `--marrom-700` | botão primário |
| `--destaque` / `--destaque-suave` | `--laranja` / `--laranja-suave` | indicador ativo, anel de foco, marcador; fundo do item ativo |
| `--destaque-hover` | `#d65f00` | hover do botão flutuante (o único fundo laranja com texto) |
| `--dado` / `--dado-suave` | `#2563eb` / `#dbe6fd` | séries dos gráficos |
| `--raio-sm` / `--raio` / `--raio-lg` | 6 / 10 / 14 px | controles / cartões e listas / login e banner |
| `--sombra-2` | `0 8px 24px …` | só o que flutua (menus, botão flutuante, banner, tooltip) |

Cartões e listas não têm sombra: têm `border: 1px solid var(--borda)`. As cores
de classificação (`--verde`, `--amarelo`, `--laranja`, `--vermelho` e os pares
`*-suave`/`*-texto`) mantêm nomes e valores.

## A regra das cores da marca

**Marrom e laranja só na marca e nas ações.** Marrom: logotipo, nome da marca,
item ativo da navegação, botão primário. Laranja: onde não há texto sobre ele
(indicador ativo, anel de foco, marcador "Hoje"), com uma exceção, o botão
flutuante "+ Novo cliente". Laranja com texto branco dá 3.2:1 e reprova AA, por
isso o botão primário é marrom. Todo o resto (fundos, superfícies, bordas,
texto) é neutro.
