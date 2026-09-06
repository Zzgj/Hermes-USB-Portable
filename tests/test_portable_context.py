import importlib.util
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "context_probe", Path(__file__).resolve().parents[1] / "scripts/inspect-portable-context.py"
)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class ContextTests(unittest.TestCase):
    def test_context_checks_are_read_only_and_redacted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            config = root / "data/config.yaml"
            config.write_text("SECRET_SENTINEL", encoding="utf-8")
            fake_yaml = types.SimpleNamespace(safe_load=lambda _: {"terminal": {"cwd": str(root / "missing")}})
            with patch.dict("sys.modules", {"yaml": fake_yaml}):
                result = probe.inspect(root)
            self.assertFalse(result["LocalTerminalCwdExists"])
            self.assertFalse(result["PortableInterpreterUsed"])
            self.assertEqual(config.read_text(), "SECRET_SENTINEL")
            self.assertNotIn(directory, str(result))
            self.assertNotIn("SECRET_SENTINEL", str(result))

    def test_remote_cwd_is_not_a_host_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            (root / "data/config.yaml").write_text("fixture")
            fake_yaml = types.SimpleNamespace(safe_load=lambda _: {"terminal": {"backend": "ssh", "cwd": "/remote/only"}})
            with patch.dict("sys.modules", {"yaml": fake_yaml}):
                self.assertTrue(probe.inspect(root)["LocalTerminalCwdExists"])

    def test_malformed_config_is_not_healthy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            (root / "data/config.yaml").write_text("fixture")
            fake_yaml = types.SimpleNamespace(safe_load=lambda _: ["not", "a", "mapping"])
            with patch.dict("sys.modules", {"yaml": fake_yaml}):
                self.assertFalse(probe.inspect(root)["ConfigReadable"])

    def test_development_venv_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src/hermes-agent/.venv").mkdir(parents=True)
            with patch.dict("sys.modules", {"yaml": types.SimpleNamespace()}):
                self.assertTrue(probe.inspect(root)["SourceDevelopmentVenvPresent"])


if __name__ == "__main__":
    unittest.main()
