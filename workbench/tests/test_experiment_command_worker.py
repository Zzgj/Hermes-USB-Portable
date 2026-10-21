"""Worker contract tests; native Job tests are explicitly Windows-only."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
_spec = importlib.util.spec_from_file_location('experiment_worker_test', SCRIPTS / 'experiment-command-worker.py')
assert _spec is not None and _spec.loader is not None
worker = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(worker)


class WorkerContractTests(unittest.TestCase):
    def test_stdout_bytes_and_nonzero_exit_are_recorded_without_shell_or_stdin(self):
        for code in (0, 9):
            with self.subTest(code=code), tempfile.TemporaryDirectory(prefix='experiment-worker-') as directory:
                root = Path(directory)
                child = Mock(stdout=io.BytesIO(b'output\x00\n'))
                child.wait.return_value = code
                spawn = Mock(return_value=child)
                self.assertEqual(worker.capture([sys.executable, '-c', 'unused'], root, 1024, spawn), 0)
                self.assertEqual((root / 'stdout.bin').read_bytes(), b'output\x00\n')
                self.assertEqual(json.loads((root / 'result.json').read_text()), {'schema': 1, 'exitCode': code, 'bytes': 8})
                self.assertEqual(spawn.call_args.kwargs, {'stdin': subprocess.DEVNULL, 'stdout': subprocess.PIPE,
                                 'stderr': subprocess.DEVNULL, 'shell': False, 'close_fds': True})
                self.assertTrue(child.stdout.closed)

    def test_overflow_exits_worker_without_waiting_or_publishing_success(self):
        with tempfile.TemporaryDirectory(prefix='experiment-worker-') as directory:
            root = Path(directory)
            child = Mock(stdout=io.BytesIO(b'x' * 100))
            self.assertEqual(worker.capture([sys.executable], root, 16, Mock(return_value=child)), 105)
            child.wait.assert_not_called()
            self.assertFalse((root / 'result.json').exists())
            self.assertLessEqual((root / 'stdout.bin').stat().st_size, 16)
            self.assertTrue(child.stdout.closed)

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory(prefix='experiment-worker-') as directory:
            root = Path(directory)
            (root / 'stdout.bin').write_bytes(b'sentinel')
            child = Mock(stdout=io.BytesIO(b'new'))
            with self.assertRaises(FileExistsError):
                worker.capture([sys.executable], root, 1024, Mock(return_value=child))
            self.assertEqual((root / 'stdout.bin').read_bytes(), b'sentinel')
            self.assertFalse((root / 'result.json').exists())
            self.assertTrue(child.stdout.closed)

    def test_invalid_arguments_do_not_spawn(self):
        spawn = Mock()
        for command, limit in (([], 10), (['relative'], 10), ([sys.executable], 0), ([sys.executable], 16777217)):
            with self.assertRaises(ValueError):
                worker.capture(command, Path('unused'), limit, spawn)
        spawn.assert_not_called()


@unittest.skipUnless(os.name == 'nt', 'requires native Windows Job supervision')
class WorkerWindowsTests(unittest.TestCase):
    def exercise(self, code, limit, expected_worker_exit):
        # Synthetic child only. No installer, runtime acquisition, or Hermes.
        root = Path(tempfile.mkdtemp(prefix='experiment-worker-native-'))
        process = subprocess.Popen([sys.executable, '-I', str(SCRIPTS / 'native-entry-host.py'), 'dashboard', '--',
                                   '-I', str(SCRIPTS / 'experiment-command-worker.py'), str(root), str(limit), '--',
                                   sys.executable, '-I', '-c', code], stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert process.stdin is not None and process.stdout is not None and process.stderr is not None
        # Keep stdin OPEN until normal completion. communicate() would send EOF
        # and exercise cancellation instead of a completed worker.
        import queue
        import threading
        frames, readers = queue.Queue(), []
        for stream, collect in ((process.stdout, True), (process.stderr, False)):
            def drain(stream=stream, collect=collect):
                for line in iter(stream.readline, b''):
                    if collect:
                        frames.put(line)
            thread = threading.Thread(target=drain, daemon=True)
            thread.start(); readers.append(thread)
        confirmed = False
        try:
            self.assertEqual(json.loads(frames.get(timeout=10)), {'event': 'started'})
            self.assertEqual(json.loads(frames.get(timeout=20)), {'event': 'closed', 'treeExited': True, 'exitCode': expected_worker_exit})
            self.assertEqual(process.wait(timeout=5), 0)
            confirmed = True
            if expected_worker_exit == 0:
                return json.loads((root / 'result.json').read_text()), (root / 'stdout.bin').read_bytes()
            self.assertFalse((root / 'result.json').exists())
        finally:
            process.stdin.close()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait(timeout=5)
            for thread in readers:
                thread.join(timeout=5)
            drained = not any(thread.is_alive() for thread in readers)
            if drained:
                process.stdout.close(); process.stderr.close()
            # A killed host is not proof of tree exit. Preserve unknown roots.
            if confirmed and drained:
                import shutil
                shutil.rmtree(root)
            self.assertTrue(drained, 'owned readers did not drain; fixture retained')

    def test_native_worker_success(self):
        result = self.exercise('print("synthetic output")', 1024, 0)
        assert result is not None
        receipt, output = result
        self.assertEqual(receipt['exitCode'], 0)
        self.assertEqual(output.strip(), b'synthetic output')

    def test_native_worker_business_failure(self):
        result = self.exercise('raise SystemExit(7)', 1024, 0)
        assert result is not None
        receipt, _ = result
        self.assertEqual(receipt['exitCode'], 7)

    def test_native_worker_output_overflow(self):
        self.exercise('print("x"*4096)', 16, 105)


if __name__ == '__main__':
    unittest.main()
