# Estilos do ChokoCRM

CSS escrito à mão, sem framework. Mobile-first: a base é o celular (largura de
referência 390 px) e o desktop (≥ 768 px) vem por cima.

## Ordem de import

`main.tsx` importa, nesta ordem:

1. as fontes `@fontsource/figtree` (400, 500, 600, 700), servidas pelo próprio app;
2. `global.css`, que começa com `@import` de `tokens.css`, `tipografia.css` e
   `formularios.css` (o `@import` precisa vir antes de qualquer regra);
3. `desktop.css`, por último, para vencer na cascata as regras de mesma
   especificidade do `global.css`.

## O que vive em cada arquivo

| Arquivo | Conteúdo |
|---|---|
| `tokens.css` | Variáveis em `:root`: cores, espaçamentos, raios, sombra, fontes e escala de tipografia. Única fonte de valores crus (hex). |
| `tipografia.css` | Fonte, tamanho e altura de linha do corpo; títulos (`h1`–`h3`, `.card-titulo`). |
| `formularios.css` | Campos (`.campo`), botões (`.btn-*`), controle segmentado, área de texto. |
| `global.css` | Base e componentes do celular, em 25 seções numeradas (moldura, cartões, listas, navegação, ficha, agenda, painel...). |
| `desktop.css` | Tudo de ≥ 768 px: grade navegação lateral + conteúdo, duas colunas, ajustes de 1024 e 1200. |

## Tokens semânticos

Nas regras dos componentes, use estes nomes em vez de hex ou das cores da marca.

| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#f4f5f7` | fundo da página |
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
