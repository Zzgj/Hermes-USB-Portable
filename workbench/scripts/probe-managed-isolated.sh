#!/usr/bin/env bash
set -euo pipefail
probe_source=$(realpath -- "${1:?Pass an existing credential-free Hermes checkout}")
probe_scripts=$(realpath -- "$(dirname -- "${BASH_SOURCE[0]}")")
probe_node=$(command -v node)
test -x "$probe_source/venv/bin/python"
test -f "$probe_source/hermes_cli/main.py"
if test -e "$probe_source/.env"; then
  echo 'Refusing source .env' >&2
  exit 1
fi
command -v bwrap >/dev/null
exec bwrap --unshare-all --die-with-parent --new-session \
  --ro-bind / / --tmpfs /home --tmpfs /root --tmpfs /tmp --tmpfs /run \
  --proc /proc --dev /dev \
  --ro-bind "$probe_source" "$probe_source" \
  --ro-bind "$probe_scripts" /tmp/p2-scripts \
  --ro-bind "$probe_node" /tmp/p2-node \
  --clearenv --setenv PATH /usr/bin:/bin \
  --setenv P2_ISOLATED_PROBE 1 \
  --chdir "$probe_source" -- /tmp/p2-node /tmp/p2-scripts/probe-managed.mjs "$probe_source"
