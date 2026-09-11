#!/usr/bin/env bash
# Linux development-only probe. Does not configure the portable Windows instance.
set -euo pipefail
probe_source=${1:?Pass the absolute path to an existing Hermes source checkout}
probe_source=$(realpath -- "$probe_source")
probe_script=$(realpath -- "$(dirname -- "${BASH_SOURCE[0]}")/probe-hermes-protocol.py")
learn_script=$(realpath -- "$(dirname -- "${BASH_SOURCE[0]}")/prepare-learn.py")
test -f "$probe_source/hermes_cli/main.py"
test -x "$probe_source/venv/bin/python"
if test -e "$probe_source/.env"; then
  echo 'Refusing a checkout containing .env; prepare a credential-free checkout.' >&2
  exit 1
fi
command -v bwrap >/dev/null
exec bwrap --unshare-all --die-with-parent --new-session \
  --ro-bind / / --tmpfs /home --tmpfs /root --tmpfs /tmp --tmpfs /run \
  --proc /proc --dev /dev \
  --ro-bind "$probe_source" "$probe_source" \
  --ro-bind "$probe_script" /tmp/probe.py \
  --ro-bind "$learn_script" /tmp/prepare-learn.py \
  --clearenv --setenv PATH /usr/bin:/bin \
  --setenv HERMES_HOME /tmp/p2-data --setenv P2_ISOLATED_PROBE 1 \
  --setenv PYTHONDONTWRITEBYTECODE 1 --setenv PYTHONUNBUFFERED 1 \
  --chdir "$probe_source" -- "$probe_source/venv/bin/python" /tmp/probe.py
