"""Production build() with synthetic archives and a strict read-only Git double.

No Git subprocess, network, vendor executable, dependency install or real package
is used. These tests prove builder wiring, not Windows runtime compatibility.
"""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
SPEC = importlib.util.spec_from_file_location('online_build_contract', SCRIPTS / 'build-online-package.py')
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
COMMIT = '1' * 40  # Synthetic Git identity, never an actual delivery revision.
BOOTSTRAP = (
    'install-online-experiment.mjs', 'material-path.mjs',
    'experiment-command.mjs', 'native-process-protocol.mjs',
    'native-entry-host.py', 'windows-job-host.py', 'experiment-command-worker.py',
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class OnlineBuildContractTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='online-build-contract-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.repository = self.root / 'repository'
        self.repository.mkdir()
        self.archives = self.root / 'archives'
        self.archives.mkdir()
        self.output = self.root / 'output'
        self.status = b''
        self.git_calls = []
        self.make_archives()
        self.source = {'workbench/scripts/' + name: (SCRIPTS / name).read_bytes() for name in BOOTSTRAP}
        self.source['docs/p2/ONLINE-TEST-START.md'] = b'# Synthetic first-use guide\n'
        self.source['manifests/portable-release.json'] = (SCRIPTS.parents[1] / 'manifests/portable-release.json').read_bytes()
        self.lock_archives()
        self.original_archives = {p.name: p.read_bytes() for p in self.archives.iterdir()}
        self.git_patch = patch.object(MODULE.subprocess, 'check_output', side_effect=self.git)
        self.git_patch.start()
        self.addCleanup(self.git_patch.stop)

    def make_archives(self, npmrc=b''):
        with tarfile.open(self.archives / 'python.archive', 'w:gz') as archive:
            data = b'synthetic-python-not-executable'
            member = tarfile.TarInfo('python/python.exe')
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        entries = {
            'node': [('node-v1.2.3-win-x64/node.exe', b'synthetic-node-not-executable'),
                     ('node-v1.2.3-win-x64/node_modules/npm/.npmrc', npmrc),
                     ('node-v1.2.3-win-x64/node_modules/npm/bin/npm-cli.js', b'// synthetic\n')],
            'uv': [('uv.exe', b'synthetic-uv-not-executable')],
            'ripgrep': [('ripgrep-1.2.3-x86_64-pc-windows-msvc/rg.exe', b'synthetic-rg-not-executable')],
        }
        for identifier, files in entries.items():
            with zipfile.ZipFile(self.archives / (identifier + '.archive'), 'w') as archive:
                for name, data in files:
                    archive.writestr(name, data)
        (self.archives / 'portablegit.archive').write_bytes(b'synthetic-sfx-not-executable')

    def lock_archives(self):
        components = []
        for identifier in ('python', 'node', 'uv', 'ripgrep', 'portablegit'):
            data = (self.archives / (identifier + '.archive')).read_bytes()
            kind = 'tar.gz' if identifier == 'python' else '7z-sfx' if identifier == 'portablegit' else 'zip'
            components.append({'id': identifier, 'version': '1.2.3',
                               'source': {'archive_type': kind, 'size_bytes': len(data),
                                          'url': 'https://example.invalid/synthetic/' + identifier},
                               'integrity': {'sha256': sha(data)}})
        self.source['manifests/runtime-components.windows-x64.json'] = json.dumps({'components': components}).encode()

    def git(self, command):
        self.assertEqual(command[:3], ['git', '-C', str(self.repository)])
        args = command[3:]
        self.git_calls.append(args)
        if args == ['rev-parse', 'HEAD']:
            return (COMMIT + '\n').encode()
        if args == ['status', '--porcelain=v1', '--untracked-files=all']:
            return self.status
        if len(args) == 2 and args[0] == 'show' and args[1].startswith(COMMIT + ':'):
            return self.source[args[1][len(COMMIT) + 1:]]
        self.fail('Unexpected Git command at synthetic boundary')

    def test_build_writes_exact_archive_manifest_projection_and_checksum(self):
        result = MODULE.build(self.repository, self.archives, self.output)
        archive = Path(result['archive'])
        self.assertEqual(archive.parent, self.output)
        self.assertEqual(result['projectCommit'], COMMIT)
        self.assertEqual(result['version'], 'bete0.0.1')
        self.assertEqual(archive.name, 'bete0.0.1.zip')
        self.assertEqual(result['status'], 'built-not-verified')
        self.assertFalse(result['release_ready'])
        self.assertEqual(result['sha256'], sha(archive.read_bytes()))
        self.assertEqual(Path(str(archive) + '.sha256').read_text(), result['sha256'] + '  ' + archive.name + '\n')
        prefix = 'bete0.0.1/'
        with zipfile.ZipFile(archive) as zipped:
            self.assertIsNone(zipped.testzip())
            names = zipped.namelist()
            self.assertEqual(len(names), len(set(name.casefold() for name in names)))
            manifest = json.loads(zipped.read(prefix + 'online-package.json'))
            self.assertEqual(manifest['projectCommit'], COMMIT)
            self.assertEqual(manifest['version'], 'bete0.0.1')
            self.assertEqual(zipped.read(prefix + 'manifests/portable-release.json'), self.source['manifests/portable-release.json'])
            self.assertFalse(manifest['release_ready'])
            self.assertTrue(manifest['requiresNetwork'])
            self.assertEqual(manifest['windowsAcceptance'], 'not-performed-by-builder')
            inventory = {entry['path']: entry for entry in manifest['files']}
            expected = {'runtime/python/python.exe', 'runtime/node/node.exe',
                        'runtime/node/node_modules/npm/bin/npm-cli.js', 'runtime/uv/uv.exe',
                        'runtime/bin/rg.exe', 'archives/portablegit.exe',
                        'runtime-components.windows-x64.json', 'START-HERE.md', 'Install-Online.bat',
                        'manifests/portable-release.json'}
            expected.update('workbench/scripts/' + name for name in BOOTSTRAP)
            self.assertEqual(set(inventory), expected)
            self.assertEqual(len(inventory), len(manifest['files']))
            self.assertEqual(set(names), {prefix + path for path in expected} | {prefix + 'online-package.json'})
            for path, entry in inventory.items():
                data = zipped.read(prefix + path)
                self.assertEqual(entry['size'], len(data), path)
                self.assertEqual(entry['sha256'], sha(data), path)
                self.assertEqual((self.output / prefix / path).read_bytes(), data, path)
            for name in BOOTSTRAP:
                path = 'workbench/scripts/' + name
                self.assertEqual(zipped.read(prefix + path), self.source[path])
            self.assertEqual(zipped.read(prefix + 'START-HERE.md'), self.source['docs/p2/ONLINE-TEST-START.md'])
            self.assertEqual(manifest['omittedVendorFiles'], [{'path': 'runtime/node/node_modules/npm/.npmrc',
                             'size': 0, 'sha256': sha(b''), 'reason': 'empty-vendor-config-omitted'}])
            launcher = zipped.read(prefix + 'Install-Online.bat')
            self.assertIn(b'%~dp0runtime\\node\\node.exe', launcher)
            self.assertIn(b'%~dp0workbench\\scripts\\install-online-experiment.mjs', launcher)
            self.assertNotIn(b'\n', launcher.replace(b'\r\n', b''))
        self.assertEqual({p.name: p.read_bytes() for p in self.archives.iterdir()}, self.original_archives)

    def test_last_archive_size_or_hash_mismatch_precedes_all_extraction(self):
        last = self.archives / 'portablegit.archive'
        original = last.read_bytes()
        for corruption in (original + b'changed-size', bytes([original[0] ^ 1]) + original[1:]):
            with self.subTest(size=len(corruption)):
                last.write_bytes(corruption)
                with patch.object(MODULE, 'extract_locked', wraps=MODULE.extract_locked) as extract:
                    with self.assertRaisesRegex(ValueError, 'ARCHIVE_IDENTITY_MISMATCH'):
                        MODULE.build(self.repository, self.archives, self.output)
                    extract.assert_not_called()
                self.assertFalse(self.output.exists())
        self.assertEqual(last.read_bytes(), corruption)  # No repair/deletion by builder.

    def test_release_identity_rejected_before_extraction(self):
        original = json.loads(self.source['manifests/portable-release.json'])
        for change in ({'version': '../escape'}, {'version': 'CON'}, {'version': 'bete0.0.1 '},
                       {'schema': True}, {'hermesCommit': '0' * 40}, {'release_ready': True},
                       {'updateCapability': 'available'}, {'distribution': {'kind': 'github-releases', 'repository': 'other/repository'}}):
            with self.subTest(change=change):
                self.source['manifests/portable-release.json'] = json.dumps({**original, **change}).encode()
                with patch.object(MODULE, 'extract_locked', wraps=MODULE.extract_locked) as extract:
                    with self.assertRaisesRegex(ValueError, 'RELEASE_IDENTITY_INVALID'):
                        MODULE.build(self.repository, self.archives, self.output)
                    extract.assert_not_called()
                self.assertFalse(self.output.exists())

    def test_existing_output_preserves_sentinel_without_git_or_extraction(self):
        self.output.mkdir()
        sentinel = self.output / 'keep'
        sentinel.write_bytes(b'synthetic-sentinel')
        with self.assertRaisesRegex(ValueError, 'NEW_EXTERNAL_OUTPUT_REQUIRED'):
            MODULE.build(self.repository, self.archives, self.output)
        self.assertEqual(sentinel.read_bytes(), b'synthetic-sentinel')
        self.assertEqual(self.git_calls, [])

    def test_output_inside_source_is_rejected_before_git(self):
        with self.assertRaisesRegex(ValueError, 'NEW_EXTERNAL_OUTPUT_REQUIRED'):
            MODULE.build(self.repository, self.archives, self.repository / 'output')
        self.assertFalse((self.repository / 'output').exists())
        self.assertEqual(self.git_calls, [])

    def test_dirty_source_rejects_before_archive_extraction(self):
        self.status = b'?? synthetic-untracked.txt\n'
        with patch.object(MODULE, 'extract_locked', wraps=MODULE.extract_locked) as extract:
            with self.assertRaisesRegex(ValueError, 'CLEAN_FIXED_SOURCE_REQUIRED'):
                MODULE.build(self.repository, self.archives, self.output)
            extract.assert_not_called()
        self.assertFalse(self.output.exists())
        self.assertFalse(any(args[0] == 'show' for args in self.git_calls))

    def test_nonempty_vendor_config_preserves_failed_stage_without_zip(self):
        self.make_archives(npmrc=b'synthetic-setting=true\n')
        self.lock_archives()
        with self.assertRaisesRegex(ValueError, 'VENDOR_NPMRC_NOT_EMPTY_REGULAR_FILE'):
            MODULE.build(self.repository, self.archives, self.output)
        config = self.output / 'bete0.0.1/runtime/node/node_modules/npm/.npmrc'
        self.assertEqual(config.read_bytes(), b'synthetic-setting=true\n')
        self.assertFalse((self.output / 'bete0.0.1/online-package.json').exists())
        self.assertEqual(list(self.output.glob('*.zip')), [])
        self.assertEqual(list(self.output.glob('*.sha256')), [])


if __name__ == '__main__':
    unittest.main()
