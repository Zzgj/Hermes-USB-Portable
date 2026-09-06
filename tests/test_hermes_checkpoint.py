import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("checkpoint", Path(__file__).resolve().parents[1] / "scripts/hermes-checkpoint.py")
checkpoint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checkpoint)


class CheckpointTests(unittest.TestCase):
    def fixture(self, root):
        (root / "launch.bat").write_text("fixture")
        for tree in checkpoint.MANAGED:
            (root / tree).mkdir(parents=True)
            (root / tree / "file.txt").write_text("original")
        (root / "data").mkdir()
        (root / "data/.env").write_text("SECRET_SENTINEL")

    def test_verified_backup_excludes_user_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            saved = checkpoint.create(root)
            manifest = checkpoint.verify(root, saved)
            self.assertFalse((saved / "payload/data").exists())
            self.assertNotIn("SECRET_SENTINEL", json.dumps(manifest))
            self.assertEqual((root / "data/.env").read_text(), "SECRET_SENTINEL")
            (saved / "payload/src/hermes-agent/file.txt").write_text("tampered")
            with self.assertRaises(ValueError):
                checkpoint.verify(root, saved)

    def test_manifest_escape_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            saved = checkpoint.create(root)
            file = saved / "manifest.json"
            manifest = json.loads(file.read_text())
            manifest["entries"][0]["path"] = "../data/.env"
            file.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                checkpoint.verify(root, saved)

    @unittest.skipIf(os.name == "nt", "POSIX symlink case; native NTFS coverage remains required")
    def test_links_recorded_without_following(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            tree = root / "src/hermes-agent"
            (tree / "link").symlink_to(tree / "file.txt")
            saved = checkpoint.create(root)
            manifest = checkpoint.verify(root, saved)
            self.assertTrue(any(entry["kind"] == "link" for entry in manifest["entries"]))
            self.assertFalse((saved / "payload/src/hermes-agent/link").exists())
            (tree / "outside").symlink_to(root.parent)
            with self.assertRaises(ValueError):
                checkpoint.create(root)


if __name__ == "__main__":
    unittest.main()
