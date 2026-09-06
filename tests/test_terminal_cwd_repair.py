import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("cwd_repair", Path(__file__).resolve().parents[1] / "scripts/repair-terminal-cwd.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


class MappingTests(unittest.TestCase):
    def test_windows_and_msys_drive_changes(self):
        for old in (r"F:\Hermes Test\src\hermes-agent", "/f/Hermes Test/src/hermes-agent"):
            self.assertEqual(repair.mapped_cwd(old, r"E:\Hermes Test"), r"E:\Hermes Test\src\hermes-agent")

    def test_unrelated_and_ambiguous_paths_preserved(self):
        for value in (r"F:\Other\src", r"F:\Hermes Test2\src", r"E:\Hermes Test\src", r"F:\Hermes Test\..\Other", r"\\host\share\Hermes Test", "relative/path", None):
            self.assertIsNone(repair.mapped_cwd(value, r"E:\Hermes Test"))


try:
    import ruamel.yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


@unittest.skipUnless(HAS_YAML, "Round-trip integration requires ruamel.yaml")
class WriteTests(unittest.TestCase):
    def test_confirmation_backup_and_unrelated_values_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            config = root / "data/config.yaml"
            original = b'# keep comment\nterminal:\n  backend: local\n  cwd: F:/Hermes Test/src\nsecret: KEEP_PRIVATE\n'
            config.write_bytes(original)
            with patch.object(repair, "mapped_cwd", return_value=str(root)), patch("builtins.input", return_value="no"):
                repair.repair(root, True)
            self.assertEqual(config.read_bytes(), original)
            with patch.object(repair, "mapped_cwd", return_value=str(root)), patch("builtins.input", return_value="yes"):
                repair.repair(root, True)
            backups = list(config.parent.glob("config.yaml.pre-cwd-repair-*"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)
            contents = config.read_text()
            self.assertIn("# keep comment", contents)
            self.assertIn("secret: KEEP_PRIVATE", contents)
            self.assertNotIn("F:/Hermes Test/src", contents)

    def test_review_only_does_not_create_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            config = root / "data/config.yaml"
            config.write_text("terminal:\n  cwd: F:/Hermes Test/src\n")
            before = config.read_bytes()
            with patch.object(repair, "mapped_cwd", return_value=str(root)):
                repair.repair(root)
            self.assertEqual(config.read_bytes(), before)
            self.assertEqual(len(list(config.parent.iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
