"""Run ONLY inside the documented disposable, network-isolated bwrap sandbox.

No external model access, tools, user config or credential copying. Tests missing-provider failure in a disposable session.
The supervisor must hide host home/tmp and pass a fresh HERMES_HOME.
"""
import asyncio
import json
import os
import queue
import re
import secrets
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
import urllib.parse


async def check(port, token):
    import websockets

    url = f"ws://127.0.0.1:{port}/api/ws"
    rejected = False
    try:
        async with websockets.connect(url, open_timeout=10):
            pass
    except websockets.exceptions.InvalidHandshake as exc:
        status = getattr(getattr(exc, 'response', None), 'status_code', getattr(exc, 'status_code', None))
        rejected = status in (401, 403)
    async with websockets.connect(url + '?token=' + token, open_timeout=15) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), 15))
        ready_ok = ready.get('params', {}).get('type') == 'gateway.ready'
        counter = 0
        events = []
        async def rpc(method, params):
            nonlocal counter
            counter += 1
            request_id = f'p2-probe-{counter}'
            await ws.send(json.dumps({'jsonrpc': '2.0', 'id': request_id, 'method': method, 'params': params}))
            async def response():
                while True:
                    frame = json.loads(await ws.recv())
                    if frame.get('id') == request_id:
                        return frame
                    if frame.get('method') == 'event':
                        events.append(frame.get('params', {}))
            return await asyncio.wait_for(response(), 20)
        unknown = await rpc('p2.nonexistent', {})
        # Discovery only: never call command.dispatch, slash.exec or skills install/search.
        skills_reply = await rpc('skills.manage', {'action': 'list'})
        groups = skills_reply.get('result', {}).get('skills')
        skills_shape = isinstance(groups, dict) and all(
            isinstance(category, str) and isinstance(names, list)
            and all(isinstance(name, str) and bool(name) for name in names)
            for category, names in groups.items())
        learn_reply = await rpc('command.resolve', {'name': 'learn'})
        learn_resolved = learn_reply.get('result', {}).get('canonical') == 'learn'
        profiles_reply = await rpc('profiles.list', {'include_sessions': False})
        profiles = profiles_reply.get('result', {}).get('profiles')
        profiles_shape = isinstance(profiles, list) and all(
            isinstance(row, dict) and isinstance(row.get('name'), str)
            and isinstance(row.get('is_default'), bool)
            and 'model' in row and (row['model'] is None or isinstance(row['model'], str))
            and 'provider' in row and (row['provider'] is None or isinstance(row['provider'], str))
            and isinstance(row.get('display_name'), str)
            and isinstance(row.get('skill_count'), int)
            for row in profiles)
        profiles_no_sessions = isinstance(profiles, list) and all(
            not any(key in row for key in ('last_session', 'worker_session', 'canonical_session'))
            for row in profiles)
        # Resolution confirms registry metadata, not dispatch safety or Skill generation.
        no_discovery_tools = not any(event.get('type') == 'tool.start' for event in events)
        created = await rpc('session.create', {'cwd': '/tmp/p2-data', 'close_on_disconnect': True})
        result = created.get('result', {})
        sid = result.get('session_id')
        session_created = isinstance(sid, str) and bool(sid)
        if not session_created:
            return {'unauthenticated_rejected': rejected, 'gateway_ready': ready_ok,
                    'unknown_method_error_code': unknown.get('error', {}).get('code'), 'session_created': False}
        submitted = await rpc('prompt.submit', {'session_id': sid, 'text': 'P2 isolated missing-provider probe. Do not use tools.'})
        def terminal_error():
            return any(event.get('session_id') == sid and event.get('type') == 'message.complete'
                       and event.get('payload', {}).get('status') == 'error' for event in events)
        if 'error' not in submitted and not terminal_error():
            async def wait_terminal():
                while not terminal_error():
                    frame = json.loads(await ws.recv())
                    if frame.get('method') == 'event':
                        events.append(frame.get('params', {}))
            await asyncio.wait_for(wait_terminal(), 30)
        failed_safely = 'error' in submitted or terminal_error()
        tool_started = any(event.get('type') == 'tool.start' for event in events)
        # Read the durable session via HTTP without session.resume or automatic continuation.
        def read_history_http(authenticated):
            key = result.get('stored_session_id', '')
            path = '/api/sessions/' + urllib.parse.quote(key, safe='') + '/messages?limit=50&offset=0&order=latest'
            headers = {'Origin': 'http://127.0.0.1:4173'}
            if authenticated:
                headers['Authorization'] = 'Bearer ' + token
            request = urllib.request.Request(f'http://127.0.0.1:{port}' + path, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    body = json.loads(response.read(1048577))
                    return response.status, body, response.headers.get('Access-Control-Allow-Origin')
            except urllib.error.HTTPError as exc:
                return exc.code, {}, None
        history_denied, _, _ = await asyncio.to_thread(read_history_http, False)
        history_status, history_body, history_origin = await asyncio.to_thread(read_history_http, True)
        history_read = history_status == 200 and isinstance(history_body.get('messages'), list) and len(history_body['messages']) <= 50
        closed = await rpc('session.close', {'session_id': sid})
        interrupted = await rpc('session.interrupt', {'session_id': sid})
        closed_again = await rpc('session.close', {'session_id': sid})
    return {'unauthenticated_rejected': rejected, 'gateway_ready': ready_ok,
            'unknown_method_error_code': unknown.get('error', {}).get('code'),
            'session_created': session_created, 'desktop_contract': result.get('info', {}).get('desktop_contract'),
            'session_cwd_isolated': result.get('info', {}).get('cwd') == '/tmp/p2-data',
            'session_closed': closed.get('result', {}).get('closed') is True,
            'stale_interrupt_error_code': interrupted.get('error', {}).get('code'),
            'duplicate_close_false': closed_again.get('result', {}).get('closed') is False,
            'prompt_failure_observed': failed_safely, 'terminal_error_event': terminal_error(),
            'tool_not_started': not tool_started,
            'skills_list_shape': skills_shape, 'learn_registry_resolved': learn_resolved,
            'profiles_list_shape': profiles_shape, 'profiles_exclude_sessions': profiles_no_sessions,
            'history_http_read': history_read, 'history_http_unauthenticated_rejected': history_denied in (401, 403),
            'history_local_origin_allowed': history_origin == 'http://127.0.0.1:4173',
            'discovery_tool_not_started': no_discovery_tools}


def main():
    if os.environ.get('P2_ISOLATED_PROBE') != '1' or os.environ.get('HERMES_HOME') != '/tmp/p2-data':
        raise SystemExit('Refusing to run outside the documented isolated probe environment')
    os.makedirs('/tmp/p2-data', exist_ok=True)
    token = secrets.token_urlsafe(32)
    env = dict(os.environ, HERMES_DASHBOARD_SESSION_TOKEN=token)
    process = subprocess.Popen([sys.executable, '-m', 'hermes_cli.main', 'serve', '--isolated',
                                '--host', '127.0.0.1', '--port', '0'], env=env,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = queue.Queue()
    def drain():
        for line in process.stdout:
            lines.put(line)
    threading.Thread(target=drain, daemon=True).start()
    deadline = time.monotonic() + 60
    observed = []
    try:
        port = None
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=0.25)
            except queue.Empty:
                if process.poll() is not None:
                    break
                continue
            # Raw stdout can contain unexpected config details: retain only exception class.
            if 'Error' in line:
                observed.extend(re.findall(r'\b[A-Za-z]+Error\b', line))
            match = re.search(r'HERMES_(?:DASHBOARD|BACKEND)_READY port=(\d+)', line)
            if match:
                port = int(match.group(1))
                break
        if port is None:
            print(json.dumps({'started': False, 'exit_code': process.poll(), 'error_classes': sorted(set(observed))}))
            return 1
        result = asyncio.run(check(port, token))
        compiled = subprocess.run([sys.executable, '-I', '/tmp/prepare-learn.py', os.getcwd()],
                                  input=json.dumps({'source': 'P2 synthetic learning notes', 'scope': 'Draft only; ask before writing.'}),
                                  capture_output=True, text=True, timeout=10)
        prepared = json.loads(compiled.stdout) if compiled.returncode == 0 else {}
        result['learn_prompt_prepared'] = prepared.get('kind') == 'learn' and 'P2 synthetic learning notes' in prepared.get('prompt', '')
        result['learn_builder_fingerprint'] = prepared.get('builderFingerprint') == '2ea8b518d9b3db2d7e8ca707d378b9cb14478437af412094d41e20600a3ace7e'
        result['started'] = True
        print(json.dumps(result))
        passed = all(result.get(key) is True for key in ('unauthenticated_rejected', 'gateway_ready',
                     'session_created', 'session_cwd_isolated', 'session_closed', 'duplicate_close_false',
                     'prompt_failure_observed', 'tool_not_started', 'skills_list_shape',
                     'learn_registry_resolved', 'discovery_tool_not_started',
                     'profiles_list_shape', 'profiles_exclude_sessions', 'history_http_read',
                     'history_http_unauthenticated_rejected', 'history_local_origin_allowed',
                     'learn_prompt_prepared', 'learn_builder_fingerprint'))
        return 0 if passed and result.get('unknown_method_error_code') == -32601 and result.get('stale_interrupt_error_code') == 4001 else 1
    except Exception as exc:
        print(json.dumps({'probe_error_class': type(exc).__name__}))
        return 1
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == '__main__':
    raise SystemExit(main())
