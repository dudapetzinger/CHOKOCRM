#!/usr/bin/env bash
# shellcheck disable=SC2329 # o open_url da biblioteca é sempre redefinido abaixo do marcador
#
# ChokoCRM — wizard dos passos manuais do deploy no Azure (Etapa 6D).
# Guia, um passo por vez, tudo o que só pode ser feito à mão: portal do Azure,
# SonarCloud e secrets/variables do GitHub. Não cria nada no Azure sozinho.
#
# Uso (no Git Bash, de qualquer pasta do repositório):
#   bash scripts/wizard-azure.sh             # execução real
#   bash scripts/wizard-azure.sh --dry-run   # ensaio: não abre o navegador, não chama
#                                            # curl nem gh e não grava nada no repositório
#
# Tudo acima do marcador "STAGES" é a biblioteca do wizard: não editar à mão.
# Os passos do deploy ficam abaixo do marcador.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library — delightful, consistent UX. Identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear — wipe the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

# banner "Title" — opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later — it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" — clear the screen, then announce a stage and show progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." — a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." — a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL — open in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser — visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser — visit it manually: $url"
}

# pause "msg" — wait for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" — y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY — current value of KEY in ENV_FILE, if any.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "Prompt" — read a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret).
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" — like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE — upsert KEY=VALUE into ENV_FILE (creates it; replaces
# any existing line). Idempotent.
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE — set a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name — gh not ready; set it later"
}

# set_var NAME VALUE — set a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name — gh not ready; set it later"
}

# finish — clear, then a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES — author this section. One stage() per step the human takes.
# Replace the example below. Set TOTAL_STAGES to match the stages you write.
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=12

# ── Modo de execução, caminhos e memória de re-execução ───────────────────
DRY_RUN=0
case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN=1 ;;
  -h|--help)
    printf 'Uso: bash scripts/wizard-azure.sh [--dry-run]\n'
    printf '  --dry-run  ensaio: não abre o navegador, não chama curl nem gh e não grava no repositório.\n'
    exit 0 ;;
  *) printf 'Opção desconhecida: %s (use --dry-run ou --help)\n' "$1" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

REPO_GITHUB="dudapetzinger/CHOKOCRM"
export GH_REPO="$REPO_GITHUB"   # gh secret/variable sempre neste repositório
URL_GITHUB="https://github.com/$REPO_GITHUB"
SONAR_PROPS="sonar-project.properties"
MAX_TENTATIVAS=5

# Só valores NÃO secretos vão para o ENV_FILE (sufixo, região, URLs, chaves do
# Sonar, caminho do perfil de publicação). Segredos ficam apenas na memória do
# processo: DATABASE_URL, JWT_SECRET, connection string, tokens e publish profile.
if (( DRY_RUN )); then
  ENV_FILE="$(mktemp -t wizard-azure-env.XXXXXX)"
  RESUMO_FILE="$(mktemp -t wizard-azure-resumo.XXXXXX)"
else
  ENV_FILE="$REPO_ROOT/.wizard-azure.local.env"
  RESUMO_FILE="$REPO_ROOT/.wizard-azure.local.md"
fi

# No ensaio, nada sai da máquina: sem navegador, sem gh.
if (( DRY_RUN )); then
  open_url() { printf '  %s↗ (dry-run) abriria%s %s\n' "$GREEN" "$RESET" "$1"; }
  set_secret() {
    WRITTEN_SECRET+=("$1")
    printf '  %s(dry-run)%s definiria o secret %s\n' "$DIM" "$RESET" "$1"
  }
  set_var() {
    printf '  %s(dry-run)%s definiria a variable %s = %s\n' "$DIM" "$RESET" "$1" "$2"
  }
else
  # No Git Bash o explorer.exe abre a página mas costuma sair com código 1; a
  # versão da biblioteca trataria isso como falha e avisaria em toda abertura.
  open_url() {
    local url="$1"
    printf '  %s↗ abrindo%s %s\n' "$GREEN" "$RESET" "$url"
    if   command -v wslview      >/dev/null 2>&1; then
      wslview "$url" >/dev/null 2>&1 </dev/null || warn "não consegui abrir o navegador — abra manualmente: $url"
    elif command -v explorer.exe >/dev/null 2>&1; then
      explorer.exe "$url" >/dev/null 2>&1 </dev/null || true
    elif command -v xdg-open     >/dev/null 2>&1; then
      xdg-open "$url" >/dev/null 2>&1 </dev/null || warn "não consegui abrir o navegador — abra manualmente: $url"
    elif command -v open         >/dev/null 2>&1; then
      open "$url" >/dev/null 2>&1 </dev/null || warn "não consegui abrir o navegador — abra manualmente: $url"
    else
      warn "não consegui abrir o navegador — abra manualmente: $url"
    fi
  }
fi

# ── Ajudantes do roteiro ──────────────────────────────────────────────────

# _limpar "valor" — tira \r e espaços nas pontas.
_limpar() {
  local v="${1//$'\r'/}"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

# _anterior KEY — mostra o valor lembrado da execução anterior (só não secretos).
_anterior() {
  local v
  v=$(_existing "$1" || true)
  if [[ -n "$v" ]]; then note "Valor anterior: $v"; fi
}

# _desistir "motivo" — encerra com erro (em vermelho).
_desistir() {
  printf '\n  %s✗ %s%s\n' "$RED" "$1" "$RESET"
  note "Rode o wizard de novo quando tiver o valor certo (os valores não secretos ficam lembrados)."
  exit 1
}

# _url_responde URL — HEAD com curl; no ensaio, não chama nada.
_url_responde() {
  if (( DRY_RUN )); then
    note "(dry-run) pularia a checagem com curl de $1"
    return 0
  fi
  curl -fsSI --max-time 15 "$1" >/dev/null 2>&1 </dev/null
}

# _pedir_url KEY "Pergunta" dominio — URL https sem caminho nem barra final,
# conferida com curl (páginas padrão do Azure respondem 200 antes do deploy).
_pedir_url() {
  local chave="$1" rotulo="$2" dominio="$3" valor tentativa
  for ((tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++)); do
    _anterior "$chave"
    ask "$chave" "$rotulo"
    valor=$(_limpar "${!chave}")
    while [[ "$valor" == */ ]]; do valor="${valor%/}"; done
    if [[ ! "$valor" =~ ^https://[A-Za-z0-9.-]+$ ]]; then
      warn "Formato inválido: esperado https://<endereço>, sem caminho."
      continue
    fi
    if [[ "$valor" != *".$dominio" ]]; then
      warn "O endereço não termina em .$dominio — confira se copiou o certo."
    fi
    if _url_responde "$valor"; then
      printf -v "$chave" '%s' "$valor"
      return 0
    fi
    warn "$valor não respondeu (curl -fsSI, 15 s)."
    if confirm "Usar este endereço mesmo assim?"; then
      printf -v "$chave" '%s' "$valor"
      return 0
    fi
  done
  _desistir "Não consegui um endereço válido para $chave em $MAX_TENTATIVAS tentativas."
}

# _pedir_segredo KEY "Pergunta" regex "dica" — entrada oculta, validada só pelo
# formato. Nunca é gravada em disco nem repetida na tela.
_pedir_segredo() {
  local chave="$1" rotulo="$2" regex="$3" dica="$4" valor tentativa
  for ((tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++)); do
    ask_secret "$chave" "$rotulo"
    valor=$(_limpar "${!chave}")
    if [[ "$valor" =~ $regex ]]; then
      printf -v "$chave" '%s' "$valor"
      return 0
    fi
    warn "Formato inválido ($dica). Tente de novo — o valor digitado não é mostrado."
  done
  _desistir "Não recebi um valor válido para $chave em $MAX_TENTATIVAS tentativas."
}

# _pedir_texto KEY "Pergunta" regex "dica" [padrão] — valor público validado;
# Enter vazio usa o padrão (quando houver).
_pedir_texto() {
  local chave="$1" rotulo="$2" regex="$3" dica="$4" padrao="${5:-}" valor tentativa
  for ((tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++)); do
    _anterior "$chave"
    ask "$chave" "$rotulo"
    valor=$(_limpar "${!chave}")
    if [[ -z "$valor" && -n "$padrao" ]]; then valor="$padrao"; fi
    if [[ "$valor" =~ $regex ]]; then
      printf -v "$chave" '%s' "$valor"
      return 0
    fi
    warn "Valor inválido ($dica)."
  done
  _desistir "Não recebi um valor válido para $chave em $MAX_TENTATIVAS tentativas."
}

# _gerar_jwt — 48 bytes aleatórios em base64 (64 caracteres, uma linha).
_gerar_jwt() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\r\n'
  else
    head -c 48 /dev/urandom | base64 | tr -d '\r\n'
  fi
}

_tem_area_de_transferencia() {
  command -v clip.exe >/dev/null 2>&1 || command -v pbcopy >/dev/null 2>&1 ||
    command -v wl-copy >/dev/null 2>&1 || command -v xclip >/dev/null 2>&1
}

# _para_area_de_transferencia — copia o stdin para a área de transferência.
_para_area_de_transferencia() {
  if   command -v clip.exe >/dev/null 2>&1; then clip.exe
  elif command -v pbcopy   >/dev/null 2>&1; then pbcopy
  elif command -v wl-copy  >/dev/null 2>&1; then wl-copy
  else xclip -selection clipboard; fi
}

# _copiar NOME VALOR — põe um segredo na área de transferência sem mostrá-lo.
# Consome uma linha de entrada em todos os caminhos (inclusive no ensaio).
_copiar() {
  local nome="$1" valor="$2"
  if (( DRY_RUN )); then
    pause "Enter: (dry-run) copiaria $nome para a área de transferência"
    return 0
  fi
  if ! _tem_area_de_transferencia; then
    warn "Sem área de transferência disponível: cole $nome a partir da sua anotação."
    pause "Enter quando tiver colado $nome"
    return 0
  fi
  pause "Enter copia $nome para a área de transferência"
  if printf '%s' "$valor" | _para_area_de_transferencia; then
    say "${GREEN}✓${RESET} $nome copiado — cole no campo Valor e salve a linha."
  else
    warn "Não consegui copiar $nome: cole-o a partir da sua anotação."
  fi
}

_limpar_area_de_transferencia() {
  if (( ! DRY_RUN )) && _tem_area_de_transferencia; then
    printf ' ' | _para_area_de_transferencia || true
  fi
}

# _prop_sonar CHAVE — valor atual em sonar-project.properties.
_prop_sonar() {
  { grep -E "^$1=" "$SONAR_PROPS" | tail -n1 | cut -d= -f2-; } || true
}

# _pedir_publish_profile — caminho do .PublishSettings; lê só para validar.
_pedir_publish_profile() {
  local caminho tentativa
  for ((tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++)); do
    _anterior PUBLISH_PROFILE_PATH
    ask PUBLISH_PROFILE_PATH "Caminho do arquivo .PublishSettings baixado:"
    caminho=$(_limpar "$PUBLISH_PROFILE_PATH")
    caminho="${caminho#\"}"; caminho="${caminho%\"}"
    caminho="${caminho#\'}"; caminho="${caminho%\'}"
    caminho="${caminho/#\~/$HOME}"
    if [[ "$caminho" == *\\* || "$caminho" =~ ^[A-Za-z]: ]] && command -v cygpath >/dev/null 2>&1; then
      caminho=$(cygpath -u "$caminho")
    fi
    if [[ -f "$caminho" ]] && grep -q '<publishData' "$caminho"; then
      PUBLISH_PROFILE_PATH="$caminho"
      if [[ "$caminho" == "$REPO_ROOT"/* ]]; then
        warn "O arquivo está dentro do repositório: mova-o para fora (ex.: Downloads) para não commitá-lo por engano."
      fi
      return 0
    fi
    warn "Arquivo não encontrado ou não é um perfil de publicação (sem <publishData>)."
  done
  _desistir "Não encontrei o perfil de publicação em $MAX_TENTATIVAS tentativas."
}

# _configuracoes_app MODO — configurações do App Service (spec §5.4).
# MODO=tela mostra os valores públicos e o JWT_SECRET recém-gerado;
# MODO=resumo nunca mostra segredos.
_configuracoes_app() {
  local modo="$1" jwt
  if [[ "$modo" == tela ]]; then jwt="$JWT_SECRET"; else jwt="(segredo — só no portal)"; fi
  printf '%s\n' \
    "NODE_ENV = production" \
    "DATABASE_URL = (segredo — a do passo 2)" \
    "JWT_SECRET = $jwt" \
    "JWT_EXPIRES_IN = 8h" \
    "FRONTEND_URL = $SWA_URL" \
    "UPLOADS_DIR = /home/uploads" \
    "AGENDA_JOB_ENABLED = true" \
    "AGENDA_JOB_CRON = 0 6 * * *" \
    "ERP_PROVIDER = mock" \
    "ERP_MOCK_FALHAR = false" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING = (segredo — a do passo 3)" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT = false" \
    "WEBSITE_RUN_FROM_PACKAGE = 0"
}

_checklist_desligar() {
  printf '%s\n' \
    "- [ ] Application Insights: $AI → Disponibilidade → teste health-api → Desabilitar (Disable), para não receber alertas com a produção desligada (o nome pode variar)." \
    "- [ ] App Service: escalar o plano $PLAN para F1 (Gratuito) — mantém o app, as configurações e o endereço; desligue o Always On antes, se o portal exigir. Parar só o app não zera o custo: quem cobra é o plano." \
    "- [ ] Alternativa: deletar o plano $PLAN. O portal pode exigir apagar o $APP junto — o que apaga também /home/uploads e as fotos de check-in; nesse caso, religar = refazer o passo 5 e atualizar VITE_API_URL e o publish profile no GitHub." \
    "- [ ] PostgreSQL: $PG → Visão geral → Parar. Atenção: o Azure religa sozinho um servidor parado após 7 dias — se a pausa for maior, pare de novo." \
    "- [ ] Conferir o gasto em Gerenciamento de Custos (alertas de 40 % e 70 % do orçamento de US\$ 100)."
}

_checklist_religar() {
  printf '%s\n' \
    "- [ ] PostgreSQL: $PG → Visão geral → Iniciar (aguarde o status Pronto)." \
    "- [ ] App Service: escalar o plano $PLAN de volta para B1 e religar o Always On (se o plano foi deletado, criar de novo seguindo o passo 5 deste wizard)." \
    "- [ ] Se o App Service foi recriado, ele ganhou um endereço (hostname) novo: atualizar a URL do teste de disponibilidade health-api no Application Insights (https://<novo endereço>/health) e a VITE_API_URL no GitHub (variável do repositório), e disparar o deploy de novo." \
    "- [ ] Deploy: gh workflow run deploy.yml (ou um push na main)." \
    "- [ ] Application Insights: $AI → Disponibilidade → teste health-api → Habilitar (Enable) (o nome pode variar)." \
    "- [ ] Conferir o job smoke verde em $URL_GITHUB/actions e o teste de disponibilidade verde no $AI." \
    "- [ ] Antes da apresentação: conferir no Painel se as cores e a agenda ainda contam a história esperada; se não, registrar check-ins novos nos clientes-chave pelo próprio app. Não rodar o seed de novo para corrigir: ele não renova as visitas de clientes que já têm visitas."
}

_status_secret() {
  local s
  for s in "${WRITTEN_SECRET[@]}"; do
    if [[ "$s" == "$1" ]]; then
      if (( DRY_RUN )); then printf 'seria definido via gh (dry-run)'; else printf 'definido via gh'; fi
      return 0
    fi
  done
  printf 'pendente'
}

_status_var() {
  local s
  for s in "${SKIPPED[@]}"; do
    if [[ "$s" == "GitHub variable $1" ]]; then printf 'pendente'; return 0; fi
  done
  if (( DRY_RUN )); then printf 'seria definida via gh (dry-run)'; else printf 'definida via gh'; fi
}

_gravar_resumo() {
  {
    printf '# Deploy no Azure — resumo do wizard\n\n'
    printf -- '- Gerado em: %s\n' "$(date '+%Y-%m-%d %H:%M')"
    if (( DRY_RUN )); then printf -- '- Modo: dry-run (nada foi criado nem definido)\n'; fi
    printf -- '- Região: %s\n' "$REGIAO"
    printf -- '- Sufixo dos nomes: %s\n\n' "${SUFIXO:-(nenhum)}"

    printf '## Recursos\n\n| Recurso | Nome |\n|---|---|\n'
    printf '| Grupo de recursos | %s |\n' "$RG"
    printf '| PostgreSQL Flexible Server (B1ms, 16, banco chokocrm) | %s |\n' "$PG"
    printf '| Application Insights | %s |\n' "$AI"
    printf '| Static Web App (Free) | %s |\n' "$SWA"
    printf '| Plano do App Service (B1) | %s |\n' "$PLAN"
    printf '| App Service (Linux, Node 22) | %s |\n\n' "$APP"

    printf '## URLs\n\n'
    printf -- '- API: %s\n' "$VITE_API_URL"
    printf -- '- Health: %s/health\n' "$VITE_API_URL"
    printf -- '- Frontend: %s\n' "$SWA_URL"
    printf -- '- SSH do App Service: %s\n' "$SCM_URL"
    printf -- '- GitHub Actions: %s/actions\n\n' "$URL_GITHUB"

    printf '## GitHub — variables\n\n| Nome | Valor | Situação |\n|---|---|---|\n'
    printf '| AZURE_WEBAPP_NAME | %s | %s |\n' "$AZURE_WEBAPP_NAME" "$(_status_var AZURE_WEBAPP_NAME)"
    printf '| VITE_API_URL | %s | %s |\n' "$VITE_API_URL" "$(_status_var VITE_API_URL)"
    printf '| SWA_URL | %s | %s |\n\n' "$SWA_URL" "$(_status_var SWA_URL)"

    printf '## GitHub — secrets (só os nomes)\n\n| Nome | Situação |\n|---|---|\n'
    printf '| AZURE_WEBAPP_PUBLISH_PROFILE | %s |\n' "$(_status_secret AZURE_WEBAPP_PUBLISH_PROFILE)"
    printf '| AZURE_STATIC_WEB_APPS_API_TOKEN | %s |\n' "$(_status_secret AZURE_STATIC_WEB_APPS_API_TOKEN)"
    printf '| SONAR_TOKEN | %s |\n\n' "$(_status_secret SONAR_TOKEN)"

    printf '## SonarCloud (sonar-project.properties)\n\n'
    printf -- '- sonar.organization=%s\n' "$SONAR_ORGANIZATION"
    printf -- '- sonar.projectKey=%s\n' "$SONAR_PROJECT_KEY"
    printf -- '- Arquivo: %s\n\n' "$SONAR_SITUACAO"

    printf '## Configurações do App Service\n\n'
    # shellcheck disable=SC2016 # crases literais (código no Markdown)
    printf 'Startup command `npm run start:prod`; Always On ligado; SCM Basic Auth ligado.\n\n'
    _configuracoes_app resumo | sed 's/^/- /'
    printf '\n## Desligar entre janelas\n\n'
    _checklist_desligar
    printf '\n## Religar\n\n'
    _checklist_religar
  } > "$RESUMO_FILE"
}

# ──────────────────────────────────────────────────────────────────────────

if (( DRY_RUN )); then
  banner "ChokoCRM — deploy no Azure (dry-run: nada é criado nem enviado)"
else
  banner "ChokoCRM — deploy no Azure (passos manuais)"
fi

# ── 1. Grupo de recursos ──────────────────────────────────────────────────
stage "Grupo de recursos, nomes e região"
say "Você vai precisar de: assinatura Azure for Students ativa, conta no GitHub com"
say "acesso a $REPO_GITHUB e o gh autenticado (gh auth login). Reserve cerca de 1 hora."
warn "Não faça push da main antes do passo 10: o CI novo precisa do SONAR_TOKEN e o deploy, dos secrets."
if (( ! DRY_RUN )); then
  if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1 </dev/null; then
    warn "gh ausente ou não autenticado: no passo 9 os secrets/variables terão de ser definidos à mão."
  fi
fi
printf '\n'
say "Sufixo opcional para os nomes (ex.: -pac8). Os nomes do PostgreSQL são globais no Azure:"
say "se algum estiver ocupado, interrompa (Ctrl-C) e rode de novo com um sufixo."
note "Enter = sem sufixo; digite 'nenhum' para remover um sufixo lembrado."
_pedir_texto SUFIXO "Sufixo:" '^(nenhum|(-?[a-z0-9]+(-[a-z0-9]+)*)?)$' \
  "só letras minúsculas, números e hífens, sem hífen no fim" ""
if [[ "$SUFIXO" == nenhum ]]; then SUFIXO=""; fi
if (( ${#SUFIXO} > 12 )); then _desistir "Sufixo longo demais (máximo 12 caracteres)."; fi
write_env SUFIXO "$SUFIXO"

RG="rg-chokocrm"
PG="pg-chokocrm${SUFIXO}"
AI="ai-chokocrm${SUFIXO}"
SWA="swa-chokocrm${SUFIXO}"
PLAN="plan-chokocrm${SUFIXO}"
APP="app-chokocrm-api${SUFIXO}"
AZURE_WEBAPP_NAME="$APP"
note "Nomes: $RG · $PG · $AI · $SWA · $PLAN · $APP"
printf '\n'
say "Região: Brazil South se o plano B1 (App Service) e o B1ms (PostgreSQL) estiverem"
say "disponíveis para a sua assinatura; senão, East US 2."
step "Para conferir sem criar nada: abra os formulários de criação dos passos 2 e 5, escolha a"
step "região e veja se Standard_B1ms e Básico B1 aparecem; depois cancele."
note "Se uma criação falhar com RequestDisallowedByPolicy, a assinatura de estudante não aceita a região: use East US 2."
_pedir_texto REGIAO "Região [Brazil South]:" '^[A-Za-z0-9 ]+$' "nome da região, ex.: Brazil South" "Brazil South"
write_env REGIAO "$REGIAO"
open_url "https://portal.azure.com/#browse/resourcegroups"
step "+ Criar → Assinatura: Azure for Students → Grupo de recursos: $RG → Região: $REGIAO."
step "Revisar + criar → Criar."
pause "Enter quando o grupo $RG existir"

# ── 2. PostgreSQL ─────────────────────────────────────────────────────────
stage "PostgreSQL Flexible Server ($PG)"
open_url "https://portal.azure.com/#create/hub"
step "Pesquise 'Azure Database for PostgreSQL' → Servidor flexível (Flexible Server) → Criar."
note "(o nome do menu pode variar)"
step "Básico: grupo $RG · nome $PG · região $REGIAO · PostgreSQL 16 · carga de trabalho: Desenvolvimento."
step "Computação + armazenamento → Configurar servidor: Com capacidade de intermitência (Burstable),"
step "Standard_B1ms, 32 GiB; alta disponibilidade desligada."
step "Autenticação: somente PostgreSQL. Usuário administrador (ex.: chokoadmin; admin, root e"
step "postgres são reservados) e uma senha forte."
note "Use só letras maiúsculas, minúsculas e números na senha: @ # / : teriam de ser codificados na URL."
step "Rede: Acesso público (endereços IP permitidos) e marque 'Permitir acesso público de qualquer"
step "serviço do Azure dentro do Azure a este servidor'."
step "Revisar + criar → Criar (leva de 5 a 15 minutos)."
step "Ao terminar: Ir para o recurso → Configurações → Bancos de dados → + Adicionar → chokocrm → Salvar."
pause "Enter quando o servidor e o banco chokocrm existirem"
printf '\n'
say "Monte a DATABASE_URL neste formato (não é gravada em disco nem mostrada de volta):"
say "  postgresql://<usuario>:<senha>@${PG}.postgres.database.azure.com:5432/chokocrm?sslmode=require"
_pedir_segredo DATABASE_URL "Cole a DATABASE_URL (entrada oculta):" \
  '^postgresql://[^:/@]+:[^@]+@[^/:]+:5432/chokocrm\?sslmode=require$' \
  "postgresql://usuario:senha@host:5432/chokocrm?sslmode=require"
if [[ "$DATABASE_URL" != *"@${PG}.postgres.database.azure.com:5432/"* ]]; then
  warn "O host não é ${PG}.postgres.database.azure.com — confira se é o servidor certo."
fi
say "${GREEN}✓${RESET} DATABASE_URL no formato esperado."
note "Guarde-a num gerenciador de senhas: vai para o App Service (passo 5) e pode ser útil no seed (passo 11)."
pause "Enter para continuar"

# ── 3. Application Insights ───────────────────────────────────────────────
stage "Application Insights ($AI)"
open_url "https://portal.azure.com/#create/hub"
step "Pesquise 'Application Insights' → Criar."
step "Grupo $RG · nome $AI · região $REGIAO · modo baseado em workspace (aceite o workspace"
step "do Log Analytics sugerido ou crie um no mesmo grupo)."
note "(o nome do campo pode variar)"
step "Revisar + criar → Criar → Ir para o recurso."
step "Na Visão geral, copie a Cadeia de Conexão (Connection String) — começa com InstrumentationKey=."
_pedir_segredo APPLICATIONINSIGHTS_CONNECTION_STRING "Cole a connection string (entrada oculta):" \
  '^InstrumentationKey=[^;]+;.*IngestionEndpoint=https://' \
  "InstrumentationKey=...;IngestionEndpoint=https://..."
say "${GREEN}✓${RESET} Connection string no formato esperado (não é gravada em disco)."
pause "Enter para continuar"

# ── 4. Static Web App ─────────────────────────────────────────────────────
stage "Static Web App ($SWA)"
open_url "https://portal.azure.com/#create/hub"
step "Pesquise 'Static Web App' (Aplicativo Web Estático) → Criar."
step "Grupo $RG · nome $SWA · plano Gratuito (Free) · origem da implantação: Outro (Other)."
note "A região pedida no formulário é só a da API gerenciada (não usada): aceite a sugerida. (o nome do campo pode variar)"
step "Revisar + criar → Criar → Ir para o recurso."
step "Na Visão geral, copie a URL (https://<nome-aleatório>.azurestaticapps.net)."
_pedir_url SWA_URL "URL do Static Web App:" "azurestaticapps.net"
write_env SWA_URL "$SWA_URL"
step "Ainda na Visão geral: Gerenciar token de implantação (Manage deployment token) → copie o token."
note "(o nome do botão pode variar)"
_pedir_segredo AZURE_STATIC_WEB_APPS_API_TOKEN "Cole o token de implantação (entrada oculta):" \
  '^[^[:space:]]{20,}$' "uma sequência longa, sem espaços"
say "${GREEN}✓${RESET} Token recebido (fica só na memória até o passo 9)."
pause "Enter para continuar"

# ── 5. App Service ────────────────────────────────────────────────────────
stage "App Service ($APP) no plano B1 ($PLAN)"
open_url "https://portal.azure.com/#create/Microsoft.WebSite"
step "Básico: grupo $RG · nome $APP · Publicar: Código · Pilha de runtime: Node 22 LTS ·"
step "Sistema operacional: Linux · Região: $REGIAO."
step "Plano do Linux: Criar novo → $PLAN · Plano de preços: Básico B1."
note "Se houver 'Nome de host padrão exclusivo e seguro', pode deixar ligado: o endereço ganha um sufixo aleatório."
step "Implantação: implantação contínua desligada; se aparecer 'Autenticação básica', habilite."
step "Monitoramento: Application Insights = Não (a API usa o SDK; a connection string vai nas configurações)."
note "(os nomes das abas podem variar)"
step "Revisar + criar → Criar → Ir para o recurso."
step "Na Visão geral, copie o Domínio padrão (Default domain) e cole com https:// na frente."
_pedir_url VITE_API_URL "URL da API (https://<domínio padrão>):" "azurewebsites.net"
if [[ "$VITE_API_URL" != "https://$APP"* ]]; then
  warn "O domínio não começa com $APP — confira se é o App Service certo."
fi
write_env VITE_API_URL "$VITE_API_URL"
pause "Enter para ver as configurações do aplicativo"

JWT_SECRET=$(_gerar_jwt)
printf '\n'
step "Configurações → Variáveis de ambiente → Configurações de aplicativo → + Adicionar,"
step "uma por vez (nome = valor):"
note "(o nome do menu pode variar; em portais antigos fica em Configuração → Configurações de aplicativo)"
_configuracoes_app tela | sed 's/^/      /'
warn "O JWT_SECRET acima foi gerado agora: cole-o só no portal. Ele não é gravado em disco nem no resumo."
note "Re-execução: se o App Service já tem JWT_SECRET, mantenha o existente (trocar encerra as sessões abertas)."
_copiar DATABASE_URL "$DATABASE_URL"
_copiar JWT_SECRET "$JWT_SECRET"
_copiar APPLICATIONINSIGHTS_CONNECTION_STRING "$APPLICATIONINSIGHTS_CONNECTION_STRING"
_limpar_area_de_transferencia
step "Aplicar → Confirmar (o app reinicia)."
pause "Enter quando as 13 configurações estiverem salvas"

printf '\n'
step "Configurações → Configuração → Configurações gerais (Configuration → General settings):"
step "  Comando de inicialização (Startup Command): npm run start:prod"
step "  Sempre ativo (Always On): Ligado"
step "  Credenciais de publicação de autenticação básica do SCM (SCM Basic Auth Publishing Credentials): Ligado"
note "(o nome do menu pode variar)"
step "Salvar → Continuar."
pause "Enter quando estiver salvo"

printf '\n'
step "Visão geral → Baixar perfil de publicação (Download publish profile) e salve o arquivo"
step ".PublishSettings fora do repositório (ex.: Downloads)."
warn "O arquivo contém as credenciais de deploy: apague-o depois do passo 9."
_pedir_publish_profile
write_env PUBLISH_PROFILE_PATH "$PUBLISH_PROFILE_PATH"
say "${GREEN}✓${RESET} Perfil de publicação encontrado (o conteúdo não é mostrado)."
pause "Enter para continuar"

# ── 6. Teste de disponibilidade ───────────────────────────────────────────
stage "Teste de disponibilidade no Application Insights"
open_url "https://portal.azure.com/"
step "Abra o recurso $AI (busca do portal) → Investigar → Disponibilidade → + Adicionar teste padrão"
step "(Add Standard test)."
note "(o nome do menu pode variar)"
step "Nome: health-api · URL: $VITE_API_URL/health · Frequência: 5 minutos."
step "Locais de teste: 3 (ex.: Brazil South, East US, South Central US) · critério: HTTP 200."
step "Alertas: habilitado. Depois, em Alertas → Regras de alerta, abra a regra do teste e"
step "adicione um grupo de ações com notificação por e-mail."
note "O teste fica vermelho até o primeiro deploy (passo 10): é esperado."
pause "Enter quando o teste e o alerta estiverem criados"

# ── 7. Orçamento ──────────────────────────────────────────────────────────
stage "Orçamento de US\$ 100 com alertas"
open_url "https://portal.azure.com/"
step "Pesquise 'Gerenciamento de Custos' (Cost Management) → Orçamentos (Budgets) → + Adicionar."
step "Escopo: a assinatura Azure for Students · nome: orcamento-chokocrm · período: o mais longo"
step "disponível · valor: 100."
step "Condições de alerta: Real (Actual) 40 % e Real 70 % · destinatário: seu e-mail → Criar."
note "(o nome do menu pode variar) Se a assinatura de estudante não permitir orçamento, acompanhe o"
note "crédito pelo Hub de Educação (Education) do portal."
pause "Enter quando o orçamento estiver criado"

# ── 8. SonarCloud ─────────────────────────────────────────────────────────
stage "SonarCloud"
SONAR_ORG_ATUAL=$(_prop_sonar sonar.organization)
SONAR_KEY_ATUAL=$(_prop_sonar sonar.projectKey)
open_url "https://sonarcloud.io/projects/create"
step "Entre com o GitHub (Log in → GitHub) e autorize."
step "Se pedir, instale o app do SonarCloud na conta dudapetzinger e importe a organização."
step "Escolha o repositório CHOKOCRM → Configurar (Set up). Se pedir a definição de código novo,"
step "escolha 'Previous version'."
step "Método de análise: GitHub Actions; desligue a Análise Automática"
step "(Administration → Analysis Method → Automatic Analysis)."
note "(o nome do menu pode variar; o SonarCloud também aparece como SonarQube Cloud)"
note "Não precisa copiar o YAML que o SonarCloud sugere: o ci.yml e o sonar-project.properties já estão prontos."
say "Anote a organization key e a project key (Information do projeto)."
note "No sonar-project.properties hoje: organization=$SONAR_ORG_ATUAL · projectKey=$SONAR_KEY_ATUAL (Enter mantém)."
_pedir_texto SONAR_ORGANIZATION "Organization key:" '^[A-Za-z0-9_.:-]+$' \
  "letras, números, _ . : -" "$SONAR_ORG_ATUAL"
_pedir_texto SONAR_PROJECT_KEY "Project key:" '^[A-Za-z0-9_.:-]+$' \
  "letras, números, _ . : -" "$SONAR_KEY_ATUAL"
write_env SONAR_ORGANIZATION "$SONAR_ORGANIZATION"
write_env SONAR_PROJECT_KEY "$SONAR_PROJECT_KEY"
open_url "https://sonarcloud.io/account/security"
step "My Account → Security → Generate Tokens: nome chokocrm-ci → Generate → copie o token."
note "(o nome do menu pode variar)"
_pedir_segredo SONAR_TOKEN "Cole o SONAR_TOKEN (entrada oculta):" '^[^[:space:]]{20,}$' \
  "uma sequência longa, sem espaços"
say "${GREEN}✓${RESET} Token recebido (fica só na memória até o passo 9)."
pause "Enter para continuar"

# ── 9. GitHub ─────────────────────────────────────────────────────────────
stage "GitHub: secrets, variables e sonar-project.properties"
SONAR_SITUACAO="inalterado"
if [[ "$SONAR_ORGANIZATION" != "$SONAR_ORG_ATUAL" || "$SONAR_PROJECT_KEY" != "$SONAR_KEY_ATUAL" ]]; then
  if (( DRY_RUN )); then
    note "(dry-run) atualizaria $SONAR_PROPS com organization=$SONAR_ORGANIZATION e projectKey=$SONAR_PROJECT_KEY"
    SONAR_SITUACAO="seria atualizado (dry-run)"
  else
    sed -i \
      -e "s/^sonar\.organization=.*/sonar.organization=${SONAR_ORGANIZATION}/" \
      -e "s/^sonar\.projectKey=.*/sonar.projectKey=${SONAR_PROJECT_KEY}/" \
      "$SONAR_PROPS"
    SONAR_SITUACAO="atualizado — commitar antes do push"
    warn "$SONAR_PROPS foi atualizado: commite-o antes do push do passo 10."
  fi
else
  note "$SONAR_PROPS já tem esses valores: nada a mudar."
fi
printf '\n'
warn "O SONAR_TOKEN precisa existir no GitHub ANTES do primeiro push que leve o ci.yml novo;"
warn "senão o job sonarcloud falha, o CI fica vermelho e o deploy automático não roda."
printf '\n'
say "Definindo secrets e variables em $REPO_GITHUB:"
set_secret AZURE_WEBAPP_PUBLISH_PROFILE "$(cat "$PUBLISH_PROFILE_PATH")"
set_secret AZURE_STATIC_WEB_APPS_API_TOKEN "$AZURE_STATIC_WEB_APPS_API_TOKEN"
set_secret SONAR_TOKEN "$SONAR_TOKEN"
set_var AZURE_WEBAPP_NAME "$AZURE_WEBAPP_NAME"
set_var VITE_API_URL "$VITE_API_URL"
set_var SWA_URL "$SWA_URL"
if (( ${#SKIPPED[@]} )); then
  printf '\n'
  warn "Algo ficou pendente: defina à mão (mesmos nomes) em"
  say "  $URL_GITHUB/settings/secrets/actions"
  say "  $URL_GITHUB/settings/variables/actions"
  note "Os valores secretos não foram guardados: copie-os de novo do portal/SonarCloud."
fi
note "Agora apague o arquivo do perfil de publicação: $PUBLISH_PROFILE_PATH"
pause "Enter para continuar"

# ── 10. Primeiro deploy ───────────────────────────────────────────────────
stage "Primeiro deploy"
say "O deploy roda no GitHub Actions: CI verde na main → workflow Deploy (api → web → smoke)."
step "Se o $SONAR_PROPS mudou no passo 9, commite-o."
step "Envie a main: git push origin main (os commits locais da Etapa 6D vão junto e disparam o CI)."
note "Se o CI já estiver verde no GitHub e o Deploy não tiver rodado, dispare à mão: gh workflow run deploy.yml"
open_url "$URL_GITHUB/actions"
step "Acompanhe CI → Deploy até o job smoke ficar verde (o primeiro start roda as migrations)."
pause "Enter quando o Deploy terminar"
if (( DRY_RUN )); then
  note "(dry-run) pularia a espera por $VITE_API_URL/health"
else
  SAUDAVEL=0
  for ((tentativa = 1; tentativa <= 24; tentativa++)); do
    if corpo=$(curl -fsS --max-time 10 "$VITE_API_URL/health" 2>/dev/null </dev/null) &&
       [[ "$corpo" == *'"status":"ok"'* ]]; then
      SAUDAVEL=1
      break
    fi
    note "Tentativa $tentativa/24: $VITE_API_URL/health ainda não respondeu ok; nova tentativa em 5 s"
    sleep 5
  done
  if (( SAUDAVEL )); then
    say "${GREEN}✓${RESET} API saudável em $VITE_API_URL/health"
  else
    warn "A API não respondeu \"status\":\"ok\" em 2 minutos."
    note "Veja os logs em $APP → Monitoramento → Fluxo de log (Log stream) e os jobs em $URL_GITHUB/actions."
    confirm "Continuar para o seed mesmo assim?" || _desistir "Corrija o deploy e rode o wizard de novo."
  fi
fi

# ── 11. Seed ──────────────────────────────────────────────────────────────
stage "Seed dos dados de demonstração"
HOST_API="${VITE_API_URL#https://}"
SCM_URL="https://${HOST_API%%.*}.scm.${HOST_API#*.}/webssh/host"
say "Popula o banco de produção com os dados de demonstração (uma vez só)."
open_url "$SCM_URL"
note "Endereço do SSH do Kudu (pode variar). Alternativa: portal → $APP → Ferramentas de"
note "Desenvolvimento → SSH → Ir. (o nome do menu pode variar)"
step "No terminal SSH, rode:  cd /home/site/wwwroot && npm run db:seed"
note "Se o seed disser que DATABASE_URL ou JWT_SECRET não está definida, rode antes:"
note "  export DATABASE_URL='<a do passo 2>' JWT_SECRET='<qualquer valor não vazio; para o seed, serve>'"
warn "Basta rodar o seed uma vez: repetir não duplica registros, mas devolve aos valores do seed os usuários, clientes e contatos de demonstração alterados na produção."
pause "Enter quando o seed terminar"

# ── 12. Desligar / religar ────────────────────────────────────────────────
stage "Desligar entre janelas e religar"
say "Desligar entre janelas de uso (guarde o crédito de US\$ 100):"
_checklist_desligar | sed 's/^/  /'
printf '\n'
say "Religar (ex.: antes da apresentação):"
_checklist_religar | sed 's/^/  /'
printf '\n'
note "Os dois checklists também vão para o resumo."
pause "Enter para gerar o resumo"

finish
_gravar_resumo
say "Resumo gravado em $RESUMO_FILE (fora do Git; sem valores de segredo):"
printf '\n'
cat "$RESUMO_FILE"
printf '\n'
if (( DRY_RUN )); then
  note "(dry-run) arquivos temporários: $ENV_FILE e $RESUMO_FILE"
fi
