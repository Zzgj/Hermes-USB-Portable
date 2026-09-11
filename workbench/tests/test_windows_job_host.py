"""Run on Windows with portable Python. Only creates disposable sleeping children."""
import ctypes
import json
import os
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


if __name__ == '__main__':
    unittest.main()
