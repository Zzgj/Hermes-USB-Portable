"""Private bounded-output worker, run only inside native-entry-host's Job.

The outside supervisor, NOT this worker or a receipt, proves tree teardown.
No shell, credential logging, inherited stdin, or descendant cleanup by PID.
"""
import json
import os
from pathlib import Path
import subprocess
import sys


def capture(command, destination, limit, popen=subprocess.Popen):
    """Write bounded stdout; a receipt is not valid without supervisor proof."""
    if not command or not os.path.isabs(command[0]) or not 1 <= limit <= 16 * 1024 * 1024:
        raise ValueError('EXPERIMENT_WORKER_ARGUMENTS')
    process = popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL, shell=False, close_fds=True)
    # No Popen context manager: its implicit wait can hang on overflow. Exiting
    # this worker causes the outside supervisor to terminate its entire Job.
    assert process.stdout is not None
    total = 0
    try:
        with (destination / 'stdout.bin').open('xb') as output:
            while True:
                chunk = process.stdout.read(65536)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    return 105
                output.write(chunk)
        code = process.wait()
        if not isinstance(code, int) or not 0 <= code <= 0xffffffff:
            return 106
        with (destination / 'result.json').open('x', encoding='utf-8') as receipt:
            json.dump({'schema': 1, 'exitCode': code, 'bytes': total}, receipt)
        return 0
    finally:
        process.stdout.close()


def main():
    if os.name != 'nt' or len(sys.argv) < 5 or sys.argv[3] != '--':
        return 2
    try:
        return capture(sys.argv[4:], Path(sys.argv[1]), int(sys.argv[2]))
    except Exception:
        # Raw exception/command output may contain credentials. No stderr dump.
        return 106


if __name__ == '__main__':
    raise SystemExit(main())
