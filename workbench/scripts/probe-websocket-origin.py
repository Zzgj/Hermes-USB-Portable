"""Read-only origin checks inside the managed bwrap probe, never a personal service."""
import asyncio
import json
import os
import websockets

async def main():
    if os.environ.get('P2_ISOLATED_PROBE') != '1':
        raise RuntimeError('ISOLATION_REQUIRED')
    url = 'ws://127.0.0.1:' + os.environ['P2_PORT'] + '/api/ws?token=' + os.environ['P2_TOKEN']
    async with websockets.connect(url, origin=os.environ['P2_ORIGIN'], open_timeout=5) as ws:
        event = json.loads(await asyncio.wait_for(ws.recv(), 5))
        accepted = event.get('params', {}).get('type') == 'gateway.ready'
    rejected = False
    try:
        async with websockets.connect(url, origin='https://untrusted.invalid', open_timeout=5):
            pass
    except websockets.exceptions.InvalidHandshake:
        rejected = True
    print(json.dumps({'localOriginAccepted': accepted, 'foreignOriginRejected': rejected}))
    return accepted and rejected

if __name__ == '__main__':
    try:
        raise SystemExit(0 if asyncio.run(main()) else 1)
    except Exception:
        print('{"originProbeFailed":true}')
        raise SystemExit(1)
