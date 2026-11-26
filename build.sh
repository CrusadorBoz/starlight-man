#!/usr/bin/env bash
# Check and compile the TypeScript, run every test, then build the Go server
# that embeds the result. Needs Go, Node 22.18 or newer, and TypeScript 5.9.
set -euo pipefail
cd "$(dirname "$0")"
umask 022
export PATH="$HOME/.local/bin:$PATH"
TSC="${TSC:-}"
for t in node_modules/.bin/tsc ../../django/frontend/node_modules/.bin/tsc; do
    if [ -z "$TSC" ] && [ -x "$t" ]; then TSC="$t"; fi
done
if [ -z "$TSC" ]; then
    echo "TypeScript is missing. Run:  npm install --no-save typescript@5.9.3"
    exit 1
fi
rm -rf assets/js
"$TSC" -p .
node --test tests/*.test.ts | tail -8
go vet ./...
go test ./...
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o starlight-man .
ls -l starlight-man
