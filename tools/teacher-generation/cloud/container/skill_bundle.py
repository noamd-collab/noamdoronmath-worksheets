"""Build/verify exact skill archives; no home paths or extraction of links.

Only the files in the reviewed skill-lock.json enter the image. Archives are
deterministic (sorted members, fixed permissions/mtime/owners, gzip mtime=0).
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import tarfile

HERE = Path(__file__).resolve().parent
GENERATOR = HERE.parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    p = PurePosixPath(name)
    if not name or p.is_absolute() or '..' in p.parts or str(p) != name or '\\' in name:
        raise ValueError('Unsafe archive member')
    return p


def locked_files(kind, lock):
    files = lock['skills'][kind]['files']
    for name in files:
        safe_name(name)
    canonical = json.dumps(files, sort_keys=True, separators=(',', ':')).encode()
    if sha(canonical) != lock['skills'][kind]['sha256']:
        raise ValueError('Invalid skill aggregate hash')
    return files


def build(kind, source, lock):
    source = Path(source).resolve(strict=True)
    files = locked_files(kind, lock)
    raw = io.BytesIO()
    with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, expected in sorted(files.items()):
                path = source.joinpath(*safe_name(name).parts)
                if any(p.is_symlink() for p in (path, *path.parents) if p != source.parent):
                    raise ValueError('Skill links are forbidden')
                data = path.read_bytes()
                if sha(data) != expected:
                    raise ValueError('Skill hash mismatch: ' + name)
                member = tarfile.TarInfo(name)
                member.size, member.mode, member.mtime = len(data), 0o644, 0
                archive.addfile(member, io.BytesIO(data))
    return raw.getvalue()


def verify(kind, blob, lock):
    files = locked_files(kind, lock)
    found = {}
    total = 0
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as archive:
        for member in archive:
            safe_name(member.name)
            if not member.isfile() or member.name not in files or member.name in found:
                raise ValueError('Unexpected, duplicate or non-file skill member')
            total += member.size
            if member.size > 16_000_000 or total > 32_000_000:
                raise ValueError('Skill archive exceeds bound')
            data = archive.extractfile(member).read()
            if sha(data) != files[member.name]:
                raise ValueError('Skill member hash mismatch')
            found[member.name] = data
    if set(found) != set(files):
        raise ValueError('Skill archive is incomplete')
    return found


def install(bundle_dir, target, lock_path):
    bundle_dir, target = Path(bundle_dir), Path(target)
    lock_bytes = Path(lock_path).read_bytes()
    lock = json.loads(lock_bytes)
    manifest = json.loads((bundle_dir / 'skill-archives.json').read_text())
    if manifest['skillLockSha256'] != sha(lock_bytes):
        raise ValueError('Unexpected skill lock')
    verified = {}
    for kind in ('elementary', 'middle'):
        blob = (bundle_dir / (kind + '.tar.gz')).read_bytes()
        if sha(blob) != manifest['archives'][kind]['sha256']:
            raise ValueError('Archive checksum mismatch')
        verified[kind] = verify(kind, blob, lock)
    if target.exists():
        raise ValueError('Install destination must not exist')
    target.mkdir(mode=0o755, parents=True)
    for kind, files in verified.items():
        for name, data in files.items():
            path = target / kind / name
            path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            with path.open('xb') as output:
                output.write(data)
            path.chmod(0o644)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--elementary')
    parser.add_argument('--middle')
    parser.add_argument('--output', type=Path, default=HERE / 'skills')
    parser.add_argument('--install', type=Path)
    args = parser.parse_args()
    lock_path = GENERATOR / 'skill-lock.json'
    if args.install:
        install(args.output, args.install, lock_path)
        return
    if not args.elementary or not args.middle:
        parser.error('Both explicit skill roots are required to rebuild archives')
    lock_bytes = lock_path.read_bytes()
    lock = json.loads(lock_bytes)
    bundles = {kind: build(kind, getattr(args, kind), lock) for kind in ('elementary', 'middle')}
    manifest = {'version': 1, 'skillLockSha256': sha(lock_bytes), 'archives': {}}
    args.output.mkdir(parents=True, exist_ok=True)
    for kind, blob in bundles.items():
        verify(kind, blob, lock)
        with (args.output / (kind + '.tar.gz')).open('xb') as output:
            output.write(blob)
        manifest['archives'][kind] = {'sha256': sha(blob), 'bytes': len(blob),
            'files': len(lock['skills'][kind]['files']), 'skillSha256': lock['skills'][kind]['sha256']}
    with (args.output / 'skill-archives.json').open('x') as output:
        json.dump(manifest, output, indent=2, sort_keys=True)
        output.write('\n')


if __name__ == '__main__':
    main()
