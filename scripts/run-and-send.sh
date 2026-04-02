#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

cd "$REPO_DIR"
node src/cli.js run >"$TMP_FILE"
node src/send-lark.js --to "${LARK_RECIPIENT_OPEN_ID:?LARK_RECIPIENT_OPEN_ID is required}" --file "$TMP_FILE"
