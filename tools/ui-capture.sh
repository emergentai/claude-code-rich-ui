#!/bin/bash
# Drives a real Claude Code session in tmux and saves what it draws, so the mod's
# rendering can be compared with the native one (see docs/dev/ui-style-study.md).
#
# usage: tools/ui-capture.sh <name> <columns> <rows> <native|mod> <prompt-file> [wait-seconds]
#   native  runs `claude` alone; mod runs `claude --plugin-dir <this repo>`.
# Writes <out-dir>/<name>.txt (plain) and <name>.ansi (colors as <E>[..m).
# The session runs in OUT_DIR (default: a fresh temp dir) and trusts it on first use.
set -e
NAME=$1; COLS=$2; ROWS=$3; MODE=$4; PROMPT=$5; WAIT=${6:-30}
REPO=$(cd "$(dirname "$0")/.." && pwd)
OUT=${OUT_DIR:-$(mktemp -d)}
FLAGS=""
[ "$MODE" = "mod" ] && FLAGS="--plugin-dir $REPO"

tmux kill-session -t "$NAME" 2>/dev/null || true
tmux new-session -d -s "$NAME" -x "$COLS" -y "$ROWS" -c "$OUT" "claude $FLAGS"
sleep 7
tmux send-keys -t "$NAME" -l "$(cat "$PROMPT")"
tmux send-keys -t "$NAME" Enter
sleep "$WAIT"
tmux capture-pane -t "$NAME" -p -S -200 | sed 's/ *$//' > "$OUT/$NAME.txt"
tmux capture-pane -t "$NAME" -p -e -S -200 | sed 's/\x1b/<E>/g; s/ *$//' > "$OUT/$NAME.ansi"
tmux kill-session -t "$NAME"
echo "wrote $OUT/$NAME.txt and $OUT/$NAME.ansi"
