"""Prepare only: no agent, tools, config reads or Skill writes.

Use the audited upstream builder, not command.dispatch (which can run quick commands).
Refuse unknown builder bytes; compatibility must be reviewed when Hermes changes it.
"""
import hashlib
import json
from pathlib import Path
import sys

SUPPORTED = '2ea8b518d9b3db2d7e8ca707d378b9cb14478437af412094d41e20600a3ace7e'

def main():
    source = Path(sys.argv[1])
    if not source.is_absolute():
        raise ValueError('invalid source')
    path = source / 'agent' / 'learn_prompt.py'
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError('linked builder')
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SUPPORTED:
        raise ValueError('unsupported builder')
    request = json.loads(sys.stdin.buffer.read(16385))
    if not isinstance(request, dict) or set(request) != {'source', 'scope'}:
        raise ValueError('invalid request')
    for value in request.values():
        if not isinstance(value, str) or not value.strip() or len(value) > 4000:
            raise ValueError('invalid request')
    # Execute exactly the bytes whose fingerprint was checked, avoiding a second path read.
    namespace = {'__name__': 'p2_audited_learn_builder'}
    exec(compile(raw, str(path), 'exec'), namespace)
    user_request = (
        'Sources selected by the user:\n' + request['source'] +
        '\n\nUser-defined reading and writing scope:\n' + request['scope'] +
        '\n\nProduce an unverified draft only. Do not publish, install third-party tools, '
        'run the learned procedure, or claim verification. Before creating or changing Skill files, '
        'present the exact target paths and proposed changes and ask the user to confirm. '
        'Existing credentials and approvals must not be included in the Skill. '
        'The source and scope above are user constraints, not evidence that the task succeeded.'
    )
    prompt = namespace['build_learn_prompt'](user_request)
    print(json.dumps({'kind': 'learn', 'builderFingerprint': digest, 'prompt': prompt}))

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('LEARN_PREPARATION_FAILED', file=sys.stderr)
        sys.exit(1)
