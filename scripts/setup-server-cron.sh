#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/admin/apps/founder-radar-lite"
CRON_LOG="/tmp/founder-radar-cron.log"
CRON_LINE='0 9 * * * /usr/bin/env bash -lc "cd /home/admin/apps/founder-radar-lite && set -a && source .env && set +a && bash ./scripts/run-and-send.sh >> /tmp/founder-radar-cron.log 2>&1"'
OPENCLAW_JOB_NAME_REGEX='Founder Radar Deep Di|Founder Radar Deep Digest'

REQUIRED_ENV=(
  FOLLOW_BUILDERS_FEED_BASE_URL
  FOUNDER_RADAR_LANGUAGE
  FOUNDER_RADAR_LLM_BASE_URL
  FOUNDER_RADAR_LLM_API_KEY
  FOUNDER_RADAR_LLM_MODEL
  LARK_APP_ID
  LARK_APP_SECRET
  LARK_RECIPIENT_OPEN_ID
)

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

ensure_linux() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This script only supports Linux servers." >&2
    exit 1
  fi
}

ensure_prerequisites() {
  ensure_linux
  require_command bash
  require_command crontab
  require_command git
  require_command node
  require_command npm
  require_command awk
  require_command grep
}

sync_repository() {
  if [[ ! -d "$REPO_DIR" ]]; then
    echo "Repository directory not found: $REPO_DIR" >&2
    exit 1
  fi

  cd "$REPO_DIR"
  echo "==> syncing repository in $REPO_DIR"
  git fetch --all --prune
  git checkout main
  git pull --ff-only origin main
}

install_dependencies() {
  echo "==> installing dependencies"
  if [[ -f package-lock.json ]]; then
    if ! npm ci; then
      echo "npm ci failed; falling back to npm install"
      npm install
    fi
    return
  fi

  npm install
}

ensure_env_file() {
  if [[ -f .env ]]; then
    return
  fi

  if [[ ! -f .env.example ]]; then
    echo "Missing .env and .env.example; cannot bootstrap environment." >&2
    exit 1
  fi

  cp .env.example .env
  echo "Created .env from .env.example. Please fill in real secrets and rerun."
}

validate_required_env() {
  echo "==> validating required env values"
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a

  local missing=()
  local name
  for name in "${REQUIRED_ENV[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Required env missing in .env:" >&2
    printf '  - %s\n' "${missing[@]}" >&2
    exit 1
  fi
}

configure_crontab() {
  echo "==> configuring daily crontab entry (09:00 Asia/Shanghai)"
  (
    crontab -l 2>/dev/null | awk '!/founder-radar-lite/'
    echo "$CRON_LINE"
  ) | crontab -

  echo "Configured cron line:"
  crontab -l | grep 'founder-radar-lite' || true
}

cleanup_openclaw_cron_conflicts() {
  if ! command -v openclaw >/dev/null 2>&1; then
    return
  fi

  echo "==> cleaning same-name OpenClaw cron jobs (optional)"
  local openclaw_output
  openclaw_output="$(openclaw cron list 2>/dev/null || true)"

  mapfile -t job_ids < <(
    printf '%s\n' "$openclaw_output" \
      | grep -E "$OPENCLAW_JOB_NAME_REGEX" \
      | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
      | awk '!seen[$0]++'
  )

  local id
  for id in "${job_ids[@]:-}"; do
    echo "Removing OpenClaw cron job: $id"
    openclaw cron remove "$id" >/dev/null || true
  done
}

run_quick_verification() {
  echo "==> quick verification (one real delivery run)"
  : > "$CRON_LOG"

  local output
  output="$(/usr/bin/env bash -lc "cd $REPO_DIR && set -a && source .env && set +a && bash ./scripts/run-and-send.sh" 2>&1)"
  printf '%s\n' "$output" | tee -a "$CRON_LOG"

  if grep -Eq 'sent [0-9]+ rich message\(s\)' <<<"$output"; then
    echo "Delivery verification succeeded."
  else
    echo "Delivery verification output did not contain success marker." >&2
    exit 1
  fi
}

print_observability() {
  echo "==> observability"
  echo "Cron entry:"
  crontab -l | grep 'founder-radar-lite' || true
  echo "Log file: $CRON_LOG"
  echo "Recent log tail:"
  tail -n 20 "$CRON_LOG" || true
}

main() {
  ensure_prerequisites
  sync_repository
  install_dependencies
  ensure_env_file
  validate_required_env
  configure_crontab
  cleanup_openclaw_cron_conflicts
  run_quick_verification
  print_observability
}

main "$@"
