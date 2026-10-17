"""Native-entry host tests. Mocks are not Windows process-tree evidence."""
import ctypes
from contextlib import contextmanager
import importlib.util
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock

HOST = Path(__file__).resolve().parents[1] / 'scripts' / 'native-entry-host.py'
_spec = importlib.util.spec_from_file_location('p2_native_host_test', HOST)
assert _spec is not None and _spec.loader is not None
host_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(host_module)


@contextmanager
def owned_fixture():
    root = Path(tempfile.mkdtemp(prefix='p2-native-host-'))
    # Preserve a failed/unconfirmed fixture rather than deleting its handshake
    # while a process or reader may still be using it.
    yield root
    shutil.rmtree(root)


class NativeHostContractTests(unittest.TestCase):
    def test_business_stdout_cannot_forge_tree_confirmation(self):
        read_fd, write_fd = os.pipe()
        os.write(write_fd, b'{"event":"closed","treeExited":true}\nHERMES_DASHBOARD_READY port=12345\n')
        os.close(write_fd)
        ports, failure = [], threading.Event()
        host_module.drain(read_fd, ports.append, failure)
        self.assertEqual(ports, [12345])
        self.assertFalse(failure.is_set())

    def test_job_attribute_precedes_creation_and_failure_never_spawns(self):
        for accepted in (0, 1):
            kernel = Mock()
            calls = []
            def initialize(_list, _count, _flags, size):
                ctypes.cast(size, ctypes.POINTER(ctypes.c_size_t)).contents.value = 128
                return 1
            kernel.InitializeProcThreadAttributeList.side_effect = initialize
            kernel.UpdateProcThreadAttribute.side_effect = lambda *_: calls.append('job') or accepted
            kernel.CreateProcessW.side_effect = lambda *_: calls.append('create') or 1
            arguments = (kernel, 789, host_module.StartupInfo(), host_module.ProcessInfo(),
                         'python', 'command', 0, None, 'cwd', [])
            if accepted:
                host_module.create_contained_process(*arguments)
                self.assertEqual(calls, ['job', 'create'])
            else:
                with self.assertRaisesRegex(RuntimeError, 'CONTAINMENT'):
                    host_module.create_contained_process(*arguments)
                self.assertEqual(calls, ['job'])
            kernel.DeleteProcThreadAttributeList.assert_called_once()

    def test_tree_confirmation_requires_successful_query_and_zero_active(self):
        for success, active in ((0, 0), (1, 1), (1, 0)):
            kernel = Mock()
            def query(_job, _class, ptr, _size, _result):
                ctypes.cast(ptr, ctypes.POINTER(host_module.Accounting)).contents.active = active
                return success
            kernel.QueryInformationJobObject.side_effect = query
            if success:
                self.assertEqual(host_module.job_empty(kernel, 123), active == 0)
            else:
                with self.assertRaisesRegex(RuntimeError, 'QUERY'):
                    host_module.job_empty(kernel, 123)


@unittest.skipUnless(os.name == 'nt', 'requires native Windows handles')
class NativeHostWindowsTests(unittest.TestCase):
    def test_normal_direct_exit_confirms_descendant_exit_before_closed(self):
        self._exercise_exit(False)

    def test_parent_pipe_eof_confirms_entire_tree_exit(self):
        self._exercise_exit(True)

    def _exercise_exit(self, stop_by_eof):
        import json
        kernel = host_module.kernel_api()
        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        kernel.OpenProcess.restype = ctypes.c_void_p
        handles, readers = [], []
        with owned_fixture() as root:
            info, go, observed = root/'children.json', root/'go', root/'observed'
            code = (
                'import os,sys,subprocess,json,time; from pathlib import Path; '
                'info,go,observed=map(Path,sys.argv[1:]); '
                'child=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"]); '
                'staged=info.with_suffix(".writing"); staged.write_text(json.dumps([os.getpid(),child.pid])); staged.replace(info); '
                'deadline=time.monotonic()+15\n'
                'while not go.exists():\n'
                ' if time.monotonic()>deadline: raise SystemExit(9)\n'
                ' time.sleep(0.01)\n'
                'observed.write_text("go-observed")\n'
            )
            process = subprocess.Popen([sys.executable, str(HOST), 'dashboard', '--', '-c', code,
                                        str(info), str(go), str(observed)], stdin=subprocess.PIPE,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            assert process.stdin is not None and process.stdout is not None and process.stderr is not None
            frames = queue.Queue()
            def drain(stream, collect):
                for line in iter(stream.readline, b''):
                    if collect:
                        frames.put(line)
            for stream, collect in ((process.stdout, True), (process.stderr, False)):
                thread = threading.Thread(target=drain, args=(stream, collect), daemon=True)
                thread.start(); readers.append(thread)
            try:
                self.assertEqual(json.loads(frames.get(timeout=10)), {'event': 'started'})
                deadline = time.monotonic() + 10
                while not info.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                pids = json.loads(info.read_text())
                for pid in pids:
                    handle = kernel.OpenProcess(0x100001, False, pid)
                    self.assertTrue(handle, 'fixture must obtain both handles before releasing direct child')
                    handles.append(handle)
                if stop_by_eof:
                    process.stdin.close()
                else:
                    go.write_text('go')
                self.assertEqual(json.loads(frames.get(timeout=15)), {'event': 'closed', 'treeExited': True, 'exitCode': 104 if stop_by_eof else 0})
                self.assertEqual(process.wait(timeout=5), 0)
                if stop_by_eof:
                    self.assertFalse(observed.exists())
                else:
                    self.assertEqual(observed.read_text(), 'go-observed')
                for handle in handles:
                    self.assertEqual(kernel.WaitForSingleObject(handle, 0), 0)
            finally:
                process.stdin.close()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(timeout=5)
                cleanup_failed = False
                for handle in handles:
                    if kernel.WaitForSingleObject(handle, 0) != 0:
                        kernel.TerminateProcess(handle, 1)
                        cleanup_failed |= kernel.WaitForSingleObject(handle, 5000) != 0
                    kernel.CloseHandle(handle)
                for thread in readers:
                    thread.join(timeout=5)
                    cleanup_failed |= thread.is_alive()
                if not any(thread.is_alive() for thread in readers):
                    process.stdout.close(); process.stderr.close()
                self.assertFalse(cleanup_failed, 'owned fixture cleanup unconfirmed')


if __name__ == '__main__':
    unittest.main()
