"""Run on Windows with portable Python. Only creates disposable sleeping children."""
import ctypes
import json
import os
import time
from pathlib import Path
import queue
import subprocess
import sys
import threading
import unittest


@unittest.skipUnless(os.name == 'nt', 'Requires native Windows Job Objects')
class JobHostTests(unittest.TestCase):
    def test_host_termination_cleans_child_and_grandchild(self):
        self.check_descendant_cleanup(close_pipe=False)

    def test_manager_pipe_loss_cleans_child_and_grandchild(self):
        self.check_descendant_cleanup(close_pipe=True)

    def check_descendant_cleanup(self, close_pipe):
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.WaitForSingleObject.restype = ctypes.c_uint32
        kernel.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.TerminateProcess.restype = ctypes.c_int
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel.CloseHandle.restype = ctypes.c_int
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'windows-job-host.py'
        code = "import os,subprocess,sys,json,time; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); print(json.dumps([os.getpid(),p.pid]),flush=True); time.sleep(60)"
        host = subprocess.Popen([sys.executable, str(script), '--', '-c', code],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        handles = []
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(host.stdout.readline()), daemon=True).start()
        try:
            pids = json.loads(lines.get(timeout=15))
            self.assertEqual(len(pids), 2)
            for pid in pids:
                handle = kernel.OpenProcess(0x00100000 | 0x0001, False, pid)
                self.assertTrue(handle, 'Cannot acquire test-owned process handle')
                handles.append(handle)
            if close_pipe:
                # Simulate the manager disappearing without a console Ctrl+C event.
                host.stdin.close()
            else:
                host.terminate()
            host.wait(timeout=10)
            for handle in handles:
                self.assertEqual(kernel.WaitForSingleObject(handle, 5000), 0, 'Owned descendant survived host exit')
        finally:
            if host.poll() is None:
                host.kill()
                host.wait(timeout=10)
            # Cleanup only handles captured from this test's own reported children.
            for handle in handles:
                if kernel.WaitForSingleObject(handle, 0) != 0:
                    kernel.TerminateProcess(handle, 1)
                    kernel.WaitForSingleObject(handle, 5000)
                kernel.CloseHandle(handle)
            host.stdout.close()
            host.stderr.close()
            host.stdin.close()


    def test_direct_child_exits_grandchild_survives_then_host_cleans(self):
        """Child exits normally but grandchild is still alive; host exit must clean it.

        Uses a signal-file handshake: child prints PIDs then polls for a 'go'
        file. Test captures OpenProcess handles first, then creates the go file.
        This guarantees handles are held before child exits — no fixed sleep.
        Exit code propagation is verified separately in
        test_child_exit_code_propagation.
        """
        import tempfile
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.WaitForSingleObject.restype = ctypes.c_uint32
        kernel.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.TerminateProcess.restype = ctypes.c_int
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel.CloseHandle.restype = ctypes.c_int
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'windows-job-host.py'
        tmpdir = tempfile.mkdtemp(prefix='p2-job-test-')
        go_file = os.path.join(tmpdir, 'go.txt')
        done_file = os.path.join(tmpdir, 'done.txt')
        go_file_escaped = go_file.replace(chr(92), chr(92) + chr(92))
        done_file_escaped = done_file.replace(chr(92), chr(92) + chr(92))
        code = (
            "import os,subprocess,sys,json,time\n"
            "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])\n"
            "print(json.dumps([os.getpid(),p.pid]),flush=True)\n"
            f"go_file=r'{go_file_escaped}'\n"
            f"done_file=r'{done_file_escaped}'\n"
            "for _ in range(300):\n"
            "    if os.path.exists(go_file):break\n"
            "    time.sleep(0.1)\n"
            "else:sys.exit(1)\n"
            "open(done_file,'w').close()\n"
            "sys.exit(42)\n"
        )
        host = subprocess.Popen([sys.executable, str(script), '--', '-c', code],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        lines = queue.Queue()
        stdout_reader = threading.Thread(target=lambda: lines.put(host.stdout.readline()), daemon=True)
        stdout_reader.start()
        stderr_buf = []
        stderr_reader = threading.Thread(target=lambda: stderr_buf.append(host.stderr.read()), daemon=True)
        stderr_reader.start()
        handles = []
        try:
            pids = json.loads(lines.get(timeout=15))
            self.assertEqual(len(pids), 2)
            for pid in pids:
                handle = kernel.OpenProcess(0x00100000 | 0x0001, False, pid)
                self.assertTrue(handle, 'Cannot acquire test-owned process handle')
                handles.append(handle)
            # Signal child to exit now that we hold all handles
            with open(go_file, 'w') as f:
                f.write('go')
            host.wait(timeout=15)
            # Independent evidence: child must have received go signal and
            # created done.txt before exiting. If child timed out, done.txt
            # won't exist and we must not count this as a pass.
            self.assertTrue(os.path.exists(done_file),
                            'Child did not receive go signal (done.txt missing) — '
                            'grandchild cleanup cannot be attributed to normal exit')
            # Now verify grandchild cleanup
            grandchild_handle = handles[1]
            self.assertEqual(kernel.WaitForSingleObject(grandchild_handle, 5000), 0,
                             'Grandchild survived host exit')
        finally:
            if host.poll() is None:
                host.kill()
                host.wait(timeout=10)
            for handle in handles:
                if kernel.WaitForSingleObject(handle, 0) != 0:
                    kernel.TerminateProcess(handle, 1)
                    kernel.WaitForSingleObject(handle, 5000)
                kernel.CloseHandle(handle)
            # Wait for reader threads to finish before closing streams
            stdout_reader.join(timeout=5)
            stderr_reader.join(timeout=5)
            host.stdout.close()
            host.stderr.close()
            host.stdin.close()
            # Clean up signal files and temp dir
            for f in [go_file, done_file]:
                try:
                    os.remove(f)
                except OSError:
                    pass
            try:
                os.rmdir(tmpdir)
            except OSError:
                pass

    def test_child_exit_code_propagation(self):
        """Child exits with code 42; host must propagate that exit code.

        Uses signal-file handshake: child waits for 'go' file before exiting,
        ensuring the test is ready to capture the exit code. Child prints PIDs
        first; test waits for that output before signaling.

        PRODUCTION DEFECT: The daemon stdin-watch thread crashes during
        interpreter shutdown, corrupting the exit code. This test is
        expected to FAIL until lead fixes the daemon thread issue.
        Python 3.14.7, Windows 10. Expected: 42. Actual: 3221225477
        (0xC0000005 ACCESS_VIOLATION). stderr contains
        'Fatal Python error: _enter_buffered_busy'.
        """
        import tempfile
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'windows-job-host.py'
        tmpdir = tempfile.mkdtemp(prefix='p2-exit-test-')
        go_file = os.path.join(tmpdir, 'go.txt')
        go_file_escaped = go_file.replace(chr(92), chr(92) + chr(92))
        code = (
            "import os,subprocess,sys,json,time\n"
            "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])\n"
            "print(json.dumps([os.getpid(),p.pid]),flush=True)\n"
            f"go_file=r'{go_file_escaped}'\n"
            "for _ in range(300):\n"
            "    if os.path.exists(go_file):break\n"
            "    time.sleep(0.1)\n"
            "else:sys.exit(1)\n"
            "sys.exit(42)\n"
        )
        host = subprocess.Popen([sys.executable, str(script), '--', '-c', code],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        lines = queue.Queue()
        stdout_reader = threading.Thread(target=lambda: lines.put(host.stdout.readline()), daemon=True)
        stdout_reader.start()
        stderr_buf = []
        stderr_reader = threading.Thread(target=lambda: stderr_buf.append(host.stderr.read()), daemon=True)
        stderr_reader.start()
        try:
            # Wait for child to print PIDs (no fixed sleep)
            pids = json.loads(lines.get(timeout=15))
            self.assertEqual(len(pids), 2)
            # Signal child to exit
            with open(go_file, 'w') as f:
                f.write('go')
            host.wait(timeout=15)
            # Get stderr from reader buffer
            stderr_reader.join(timeout=5)
            stderr_output = stderr_buf[0] if stderr_buf else ''
            # This assertion is expected to FAIL due to the production defect.
            # Do NOT remove or skip this assertion.
            self.assertEqual(host.returncode, 42,
                             f'Exit code propagation failed: expected 42, got {host.returncode}. '
                             f'stderr snippet: {stderr_output[:200]!r}')
        finally:
            if host.poll() is None:
                host.kill()
                host.wait(timeout=10)
            stdout_reader.join(timeout=5)
            host.stdout.close()
            host.stderr.close()
            host.stdin.close()
            try:
                os.remove(go_file)
            except OSError:
                pass
            try:
                os.rmdir(tmpdir)
            except OSError:
                pass

    def test_two_independent_instances_closing_a_does_not_affect_b(self):
        """Two independent job host instances; closing A must not kill B's children."""
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.WaitForSingleObject.restype = ctypes.c_uint32
        kernel.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        kernel.TerminateProcess.restype = ctypes.c_int
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel.CloseHandle.restype = ctypes.c_int
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'windows-job-host.py'
        code = ("import os,subprocess,sys,json,time;"
                "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']);"
                "print(json.dumps([os.getpid(),p.pid]),flush=True);"
                "time.sleep(60)")
        host_a = subprocess.Popen([sys.executable, str(script), '--', '-c', code],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        host_b = subprocess.Popen([sys.executable, str(script), '--', '-c', code],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        lines_a = queue.Queue()
        lines_b = queue.Queue()
        threading.Thread(target=lambda: lines_a.put(host_a.stdout.readline()), daemon=True).start()
        threading.Thread(target=lambda: lines_b.put(host_b.stdout.readline()), daemon=True).start()
        handles_a = []
        handles_b = []
        try:
            pids_a = json.loads(lines_a.get(timeout=15))
            pids_b = json.loads(lines_b.get(timeout=15))
            for pids, handles in [(pids_a, handles_a), (pids_b, handles_b)]:
                for pid in pids:
                    handle = kernel.OpenProcess(0x00100000 | 0x0001, False, pid)
                    self.assertTrue(handle, 'Cannot acquire test-owned process handle')
                    handles.append(handle)
            # Terminate host_a
            host_a.terminate()
            host_a.wait(timeout=10)
            # A's children must be cleaned
            for handle in handles_a:
                self.assertEqual(kernel.WaitForSingleObject(handle, 5000), 0,
                                 'Instance A descendant survived A host exit')
            # B's children must still be alive
            for handle in handles_b:
                self.assertNotEqual(kernel.WaitForSingleObject(handle, 1000), 0,
                                    'Instance B descendant was affected by A host exit')
        finally:
            for host in [host_a, host_b]:
                if host.poll() is None:
                    host.kill()
                    host.wait(timeout=10)
            for handles in [handles_a, handles_b]:
                for handle in handles:
                    if kernel.WaitForSingleObject(handle, 0) != 0:
                        kernel.TerminateProcess(handle, 1)
                        kernel.WaitForSingleObject(handle, 5000)
                    kernel.CloseHandle(handle)
            for host in [host_a, host_b]:
                host.stdout.close()
                host.stderr.close()
                host.stdin.close()

    def test_containment_failure_aborts_before_child_starts(self):
        """Import production module, mock containment failure, verify Popen not called.

        Loads the actual windows-job-host.py via importlib, patches
        contain_current_process to raise RuntimeError('JOB_ASSIGN_FAILED'),
        and asserts that subprocess.Popen is never called and that the
        RuntimeError propagates (the __main__ wrapper would catch it and
        exit 103, but we test the function-level behavior directly).
        """
        import importlib.util
        from unittest.mock import patch, MagicMock

        script_path = Path(__file__).resolve().parents[1] / 'scripts' / 'windows-job-host.py'
        spec = importlib.util.spec_from_file_location('job_host_under_test', script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Patch contain_current_process to simulate Job assignment failure
        with patch.object(module, 'contain_current_process',
                          side_effect=RuntimeError('JOB_ASSIGN_FAILED')) as mock_contain, \
             patch.object(module.subprocess, 'Popen') as mock_popen:
            # Set sys.argv as main() expects: ['script', '--', '-c', 'code']
            original_argv = sys.argv
            sys.argv = [str(script_path), '--', '-c', 'pass']
            try:
                with self.assertRaises(RuntimeError, msg='containment failure must raise RuntimeError'):
                    module.main()
            finally:
                sys.argv = original_argv

            # contain_current_process must have been called exactly once
            mock_contain.assert_called_once()
            # subprocess.Popen must NOT have been called — containment failed before child spawn
            mock_popen.assert_not_called()


if __name__ == '__main__':
    unittest.main()
