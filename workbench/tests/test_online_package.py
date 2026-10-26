"""Synthetic archive tests only: no network or execution of vendor binaries."""
import importlib.util
import io
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('online_package', Path(__file__).parents[1] / 'scripts' / 'build-online-package.py')
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class OnlinePackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='online-package-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def make_zip(self, names):
        archive = self.root / 'fixture.zip'
        with zipfile.ZipFile(archive, 'w') as output:
            for name, data in names:
                output.writestr(name, data)
        return archive

    def test_vendor_resource_names_roundtrip_without_renaming(self):
        names = [('python/Lib/launcher manifest.xml', b'manifest'),
                 ('python/Lib/script (dev).tmpl', b'template')]
        archive = self.make_zip(names)
        target = self.root / 'output'
        MODULE.extract_locked(archive, target, 'zip', 'python')
        self.assertEqual((target / 'Lib' / 'launcher manifest.xml').read_bytes(), b'manifest')
        self.assertEqual((target / 'Lib' / 'script (dev).tmpl').read_bytes(), b'template')

    def test_traversal_cannot_escape_target(self):
        archive = self.make_zip([('../escaped.txt', b'no')])
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_PATH_REJECTED'):
            MODULE.extract_locked(archive, self.root / 'output', 'zip')
        self.assertFalse((self.root / 'escaped.txt').exists())

    def test_duplicate_case_alias_is_rejected(self):
        archive = self.make_zip([('a.txt', b'first'), ('A.txt', b'second')])
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_DUPLICATE_OR_LIMIT'):
            MODULE.extract_locked(archive, self.root / 'output', 'zip')
        self.assertEqual((self.root / 'output' / 'a.txt').read_bytes(), b'first')

    def test_zip_link_is_rejected(self):
        link = zipfile.ZipInfo('linked')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive = self.make_zip([(link, b'../outside')])
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_LINK_OR_SPECIAL'):
            MODULE.extract_locked(archive, self.root / 'output', 'zip')

    def test_implicit_parent_case_alias_is_rejected(self):
        archive = self.make_zip([('A/x.txt', b'first'), ('a/y.txt', b'second')])
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_PARENT_ALIAS_OR_TYPE'):
            MODULE.extract_locked(archive, self.root / 'output', 'zip')
        self.assertFalse((self.root / 'output' / 'a' / 'y.txt').exists())

    def test_shared_parent_and_later_explicit_directory_are_valid(self):
        archive = self.make_zip([('A/x.txt', b'first'), ('A/', b''), ('A/y.txt', b'second')])
        target = self.root / 'output'
        MODULE.extract_locked(archive, target, 'zip')
        self.assertEqual((target / 'A' / 'x.txt').read_bytes(), b'first')
        self.assertEqual((target / 'A' / 'y.txt').read_bytes(), b'second')

    def test_file_cannot_be_reused_as_an_implicit_parent(self):
        archive = self.make_zip([('A', b'file'), ('A/y.txt', b'second')])
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_PARENT_ALIAS_OR_TYPE'):
            MODULE.extract_locked(archive, self.root / 'output', 'zip')
        self.assertEqual((self.root / 'output' / 'A').read_bytes(), b'file')

    def test_tar_regular_file_and_link_boundary(self):
        archive = self.root / 'fixture.tar.gz'
        with tarfile.open(archive, 'w:gz') as output:
            item = tarfile.TarInfo('python/python.exe')
            item.size = 4
            output.addfile(item, io.BytesIO(b'fake'))
            link = tarfile.TarInfo('python/link')
            link.type = tarfile.SYMTYPE
            link.linkname = '../outside'
            output.addfile(link)
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_LINK_OR_SPECIAL'):
            MODULE.extract_locked(archive, self.root / 'output', 'tar.gz', 'python')
        self.assertEqual((self.root / 'output' / 'python.exe').read_bytes(), b'fake')
        self.assertFalse((self.root / 'output' / 'link').exists())

    def test_existing_target_and_wrong_prefix_fail_closed(self):
        archive = self.make_zip([('wrong/node.exe', b'fake')])
        existing = self.root / 'existing'
        existing.mkdir()
        (existing / 'keep').write_text('keep')
        with self.assertRaisesRegex(ValueError, 'EXTRACTION_TARGET_EXISTS'):
            MODULE.extract_locked(archive, existing, 'zip')
        self.assertEqual((existing / 'keep').read_text(), 'keep')
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_PREFIX_MISMATCH'):
            MODULE.extract_locked(archive, self.root / 'new', 'zip', 'expected')

    def test_windows_aliases_and_invalid_material_names(self):
        for name in ['../x', '/x', 'x\\y', 'a:stream', 'x/CON.txt', 'x/lpt1', 'x/aux', 'a//b', 'a./b', 'a /b']:
            with self.subTest(name=name):
                self.assertFalse(MODULE.material_path(name))

    def test_only_empty_vendor_npmrc_is_omitted_from_extracted_copy(self):
        names = [('node/node_modules/npm/.npmrc', b''),
                 ('node/node_modules/npm/package.json', b'{}')]
        archive = self.make_zip(names)
        target = self.root / 'node'
        MODULE.extract_locked(archive, target, 'zip', 'node')
        record = MODULE.omit_empty_vendor_npmrc(target)
        self.assertFalse((target / 'node_modules/npm/.npmrc').exists())
        self.assertEqual((target / 'node_modules/npm/package.json').read_bytes(), b'{}')
        self.assertEqual(record['path'], 'runtime/node/node_modules/npm/.npmrc')
        self.assertEqual(record['sha256'], MODULE.digest(b''))
        self.assertEqual(record['size'], 0)
        with zipfile.ZipFile(archive) as original:
            self.assertEqual(original.read('node/node_modules/npm/.npmrc'), b'')

    def test_nonempty_vendor_npmrc_is_rejected_and_preserved(self):
        target = self.root / 'node'
        config = target / 'node_modules/npm/.npmrc'
        config.parent.mkdir(parents=True)
        config.write_bytes(b'synthetic-setting=true\n')
        with self.assertRaisesRegex(ValueError, 'VENDOR_NPMRC_NOT_EMPTY_REGULAR_FILE'):
            MODULE.omit_empty_vendor_npmrc(target)
        self.assertEqual(config.read_bytes(), b'synthetic-setting=true\n')

    def test_missing_or_linked_vendor_npmrc_is_rejected(self):
        target = self.root / 'node'
        config = target / 'node_modules/npm/.npmrc'
        config.parent.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, 'VENDOR_NPMRC_NOT_EMPTY_REGULAR_FILE'):
            MODULE.omit_empty_vendor_npmrc(target)
        outside = self.root / 'outside'
        outside.write_bytes(b'')
        config.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'VENDOR_NPMRC_NOT_EMPTY_REGULAR_FILE'):
            MODULE.omit_empty_vendor_npmrc(target)
        self.assertTrue(config.is_symlink())
        self.assertEqual(outside.read_bytes(), b'')


if __name__ == '__main__':
    unittest.main()
