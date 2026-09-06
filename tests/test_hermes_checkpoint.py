import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import subprocess

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

    def test_prepare_keeps_live_trees_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            saved = checkpoint.create(root)
            (root / "src/hermes-agent/file.txt").write_text("updated")
            transaction = root / "updates/hermes-restores" / ("a" * 32)
            checkpoint.prepare_restore(root, saved, transaction)
            self.assertEqual((root / "src/hermes-agent/file.txt").read_text(), "updated")
            self.assertEqual((transaction / "new/src/hermes-agent/file.txt").read_text(), "original")
            self.assertEqual((root / "data/.env").read_text(), "SECRET_SENTINEL")

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

    @unittest.skipUnless(os.name == "nt", "Native NTFS junction case")
    def test_windows_junction_can_be_staged_without_following(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            tree = root / "src/hermes-agent"
            (tree / "workspace").mkdir()
            (tree / "workspace/package.json").write_text('{}')
            subprocess.run(["cmd.exe", "/d", "/c", "mklink", "/J", str(tree / "linked"), str(tree / "workspace")], check=True, capture_output=True)
            saved = checkpoint.create(root)
            manifest = checkpoint.verify(root, saved)
            self.assertTrue(any(entry.get("junction") for entry in manifest["entries"]))
            transaction = root / "updates/hermes-restores" / ("b" * 32)
            checkpoint.prepare_restore(root, saved, transaction)
            staged_link = transaction / "new/src/hermes-agent/linked"
            self.assertEqual(staged_link.resolve(), (tree / "workspace").resolve())
            self.assertTrue(checkpoint.linked(staged_link))


if __name__ == "__main__":
    unittest.main()
