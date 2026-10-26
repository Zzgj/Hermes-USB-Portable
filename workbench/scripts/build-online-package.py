"""Build an online-first-install candidate from a clean fixed Git revision.

Consumes already downloaded, hash-locked vendor archives. Never downloads,
executes vendor binaries, installs dependencies, or reads an installed profile.
Windows dependency installation remains a separate, interactive target step.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tarfile
import zipfile

BASELINE = '28044757aabd34010bd9f5f3e3f82b0906b46241'
BOOTSTRAP = [
    'install-online-experiment.mjs', 'material-path.mjs',
    'experiment-command.mjs', 'native-process-protocol.mjs',
    'native-entry-host.py', 'windows-job-host.py', 'experiment-command-worker.py',
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def material_path(name):
    return bool(re.fullmatch(r'[A-Za-z0-9_.@+() /-]+', name)) and all(
        part not in ('', '.', '..') and not part.endswith(('.', ' '))
        and not re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', part, re.I)
        for part in name.split('/'))


def extract_locked(archive, destination, kind, prefix=''):
    """Extract only ordinary files/directories; never follow archive links."""
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('EXTRACTION_TARGET_EXISTS')
    destination.mkdir(parents=True)
    seen = set()
    layout = {}
    total = 0

    def entry(name, size, is_directory, reader):
        nonlocal total
        name = name.removesuffix('/')
        if not material_path(name):
            raise ValueError('ARCHIVE_PATH_REJECTED')
        if prefix:
            if name == prefix and is_directory:
                return
            if not name.startswith(prefix + '/'):
                raise ValueError('ARCHIVE_PREFIX_MISMATCH')
            name = name[len(prefix) + 1:]
        key = name.casefold()
        if key in seen or len(seen) >= 100000:
            raise ValueError('ARCHIVE_DUPLICATE_OR_LIMIT')
        seen.add(key)
        parts = PurePosixPath(name).parts
        # Track implicit parents too: A/x and a/y alias on Windows even
        # though their complete member names have different casefold keys.
        for index in range(1, len(parts) + 1):
            spelling = '/'.join(parts[:index])
            identity = (spelling, index < len(parts) or is_directory)
            previous = layout.get(spelling.casefold())
            if previous is not None and previous != identity:
                raise ValueError('ARCHIVE_PARENT_ALIAS_OR_TYPE')
            layout[spelling.casefold()] = identity
        path = destination.joinpath(*parts)
        if is_directory:
            path.mkdir(parents=True, exist_ok=True)
            return
        total += size
        if size < 0 or size > 512 * 1024 * 1024 or total > 2 * 1024**3:
            raise ValueError('ARCHIVE_SIZE_LIMIT')
        path.parent.mkdir(parents=True, exist_ok=True)
        with reader() as source, path.open('xb') as output:
            written = 0
            while data := source.read(1024 * 1024):
                written += len(data)
                if written > size:
                    raise ValueError('ARCHIVE_SIZE_MISMATCH')
                output.write(data)
            if written != size:
                raise ValueError('ARCHIVE_SIZE_MISMATCH')

    if kind == 'tar.gz':
        with tarfile.open(archive, 'r:gz') as container:
            for item in container:
                if not (item.isfile() or item.isdir()) or item.issym() or item.islnk():
                    raise ValueError('ARCHIVE_LINK_OR_SPECIAL')
                entry(item.name, item.size, item.isdir(), lambda i=item: container.extractfile(i))
    elif kind == 'zip':
        with zipfile.ZipFile(archive) as container:
            for item in container.infolist():
                mode = stat.S_IFMT(item.external_attr >> 16)
                if mode not in (0, stat.S_IFREG, stat.S_IFDIR) or item.flag_bits & 1:
                    raise ValueError('ARCHIVE_LINK_OR_SPECIAL')
                entry(item.filename, item.file_size, item.is_dir(), lambda i=item: container.open(i))
    else:
        raise ValueError('ARCHIVE_KIND_REJECTED')


def omit_empty_vendor_npmrc(node_root):
    # Only the freshly extracted, hash-locked vendor copy is projected. Keep
    # private-config rejection in both runtime consumers unchanged.
    path = Path(node_root) / 'node_modules/npm/.npmrc'
    if path.is_symlink() or not path.is_file() or path.stat().st_size != 0:
        raise ValueError('VENDOR_NPMRC_NOT_EMPTY_REGULAR_FILE')
    record = {'path': 'runtime/node/node_modules/npm/.npmrc', 'size': 0,
              'sha256': digest(b''), 'reason': 'empty-vendor-config-omitted'}
    path.unlink()
    return record


def build(repository, archives, output):
    repository, archives, output = map(lambda p: Path(p).resolve(), (repository, archives, output))
    if output.exists() or output == repository or repository in output.parents:
        raise ValueError('NEW_EXTERNAL_OUTPUT_REQUIRED')

    def git(*args):
        return subprocess.check_output(['git', '-C', str(repository), *args])

    commit = git('rev-parse', 'HEAD').decode().strip()
    if not re.fullmatch('[a-f0-9]{40}', commit) or git('status', '--porcelain=v1', '--untracked-files=all'):
        raise ValueError('CLEAN_FIXED_SOURCE_REQUIRED')
    lock_bytes = git('show', f'{commit}:manifests/runtime-components.windows-x64.json')
    lock = json.loads(lock_bytes)
    components = {c['id']: c for c in lock['components']}
    identities = []
    # Validate every archive before creating the artifact root.
    for identifier in ['python', 'node', 'uv', 'ripgrep', 'portablegit']:
        component = components[identifier]
        archive = archives / (identifier + '.archive')
        if archive.is_symlink() or not archive.is_file():
            raise ValueError('PLAIN_LOCKED_ARCHIVE_REQUIRED')
        data = archive.read_bytes()
        if len(data) != component['source']['size_bytes'] or digest(data) != component['integrity']['sha256']:
            raise ValueError('ARCHIVE_IDENTITY_MISMATCH')
        identities.append({'id': identifier, 'size': len(data), 'sha256': digest(data), 'source': component['source']['url']})
    output.mkdir()
    root = output / 'Hermes-Portable-Online-Test'
    root.mkdir()
    for identifier, folder, prefix in [
        ('python', 'python', 'python'),
        ('node', 'node', 'node-v' + components['node']['version'] + '-win-x64'),
        ('uv', 'uv', ''),
        ('ripgrep', 'bin', 'ripgrep-' + components['ripgrep']['version'] + '-x86_64-pc-windows-msvc'),
    ]:
        extract_locked(archives / (identifier + '.archive'), root / 'runtime' / folder,
                       components[identifier]['source']['archive_type'], prefix)
    omitted = [omit_empty_vendor_npmrc(root / 'runtime' / 'node')]
    (root / 'archives').mkdir()
    shutil.copyfile(archives / 'portablegit.archive', root / 'archives' / 'portablegit.exe')
    (root / 'runtime-components.windows-x64.json').write_bytes(lock_bytes)
    for name in BOOTSTRAP:
        relative = 'workbench/scripts/' + name
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(git('show', f'{commit}:{relative}'))
    (root / 'START-HERE.md').write_bytes(git('show', f'{commit}:docs/p2/ONLINE-TEST-START.md'))
    (root / 'Install-Online.bat').write_bytes((
        '@echo off\r\nsetlocal\r\nset "NODE_OPTIONS="\r\nset "NODE_PATH="\r\n'
        '"%~dp0runtime\\node\\node.exe" "%~dp0workbench\\scripts\\install-online-experiment.mjs"\r\n'
        'set "RESULT=%ERRORLEVEL%"\r\necho.\r\npause\r\nexit /b %RESULT%\r\n'
    ).encode('ascii'))
    files = []
    for path in sorted(root.rglob('*')):
        if path.is_file():
            data = path.read_bytes()
            files.append({'path': path.relative_to(root).as_posix(), 'size': len(data), 'sha256': digest(data)})
    manifest = {'schema': 1, 'kind': 'online-native-experiment', 'projectCommit': commit,
                'baseline': BASELINE, 'release_ready': False, 'files': files, 'archives': identities,
                'requiresNetwork': True, 'windowsAcceptance': 'not-performed-by-builder',
                'omittedVendorFiles': omitted}
    (root / 'online-package.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    archive = output / ('Hermes-Portable-Online-Test-' + commit[:12] + '.zip')
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as zipped:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                zipped.write(path, path.relative_to(output).as_posix())
    checksum = digest(archive.read_bytes())
    (output / (archive.name + '.sha256')).write_text(checksum + '  ' + archive.name + '\n', encoding='ascii')
    return {'projectCommit': commit, 'archive': str(archive), 'sha256': checksum,
            'status': 'built-not-verified', 'release_ready': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--archives', required=True)
    parser.add_argument('--output', required=True)
    options = parser.parse_args()
    print(json.dumps(build(options.repository, options.archives, options.output)))
