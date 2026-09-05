"""Build a source-only P0 candidate; never include runtimes or user data."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


def build(root, output):
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
    allowed_roots = {'launch.bat', 'launch.sh', 'P0-Workbench.bat', 'README.md', '.gitattributes', '.gitignore'}
    files = sorted(p for p in tracked if p and (p in allowed_roots or p.split('/')[0] in {'scripts', 'tests', 'manifests', 'docs'}))
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
    manifest = {'schema_version': 1, 'candidate': 'p0-rc1', 'commit': revision, 'files': []}
    payloads = {}
    for name in files:
        path = root / name
        if path.is_symlink():
            raise ValueError(f'Symlink not allowed: {name}')
        payload = path.read_bytes()
        if name.endswith('.bat'):
            payload = payload.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        payloads[name] = payload
        manifest['files'].append({'path': name, 'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload)})
    payloads['package-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    output.mkdir(parents=True, exist_ok=True)
    archive = output / 'Hermes-Portable-P0-RC1.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, payload in sorted(payloads.items()):
            info = zipfile.ZipInfo('Hermes-Portable-P0-RC1/' + name, (2026, 9, 5, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, payload)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
    print(f'{archive}\nSHA256 {digest}\nCommit {revision}')
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    build(Path(__file__).resolve().parent.parent, args.output)
