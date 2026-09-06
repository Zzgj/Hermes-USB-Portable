"""Verified offline checkpoint of managed code/runtime, excluding user data.

Links are recorded as root-relative metadata, never traversed or copied as live
links into the backup. This permits NTFS workspace junctions without capturing
an external profile through them. Creation does not modify the live instance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import uuid

MANAGED = (".cache/runtimes/windows-x64", "src/hermes-agent")


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def linked(path):
    return path.is_symlink() or bool(getattr(path.lstat(), "st_file_attributes", 0) & 0x400)


def no_link_ancestors(path):
    for item in (path, *path.parents):
        if item.exists() and linked(item):
            raise ValueError("Linked checkpoint boundary requires review")


def inventory(root):
    entries = []
    pending = [root / name for name in MANAGED]
    for path in pending:
        no_link_ancestors(path)
        if not path.is_dir():
            raise ValueError("Managed tree missing")
    while pending:
        path = pending.pop()
        relative = path.relative_to(root).as_posix()
        if linked(path):
            target = path.resolve(strict=False).relative_to(root).as_posix()
            entries.append({"path": relative, "kind": "link", "target": target,
                            "directory": path.is_dir(), "junction": not path.is_symlink()})
        elif path.is_dir():
            entries.append({"path": relative, "kind": "directory"})
            pending.extend(path.iterdir())
        elif path.is_file():
            entries.append({"path": relative, "kind": "file", "bytes": path.stat().st_size,
                            "sha256": digest(path)})
        else:
            raise ValueError("Unsupported file type in managed trees")
    return sorted(entries, key=lambda item: item["path"])


def create(root):
    root = Path(root).absolute()
    no_link_ancestors(root)
    if not (root / "launch.bat").is_file():
        raise ValueError("Not a portable instance")
    entries = inventory(root)
    size = sum(item.get("bytes", 0) for item in entries)
    if shutil.disk_usage(root).free < size + 128 * 1024 * 1024:
        raise ValueError("Insufficient space for verified checkpoint plus reserve")
    parent = root / "updates/hermes-checkpoints"
    no_link_ancestors(parent)
    parent.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    staged = parent / ("partial-" + token)
    payload = staged / "payload"
    payload.mkdir(parents=True)
    for entry in entries:
        source = root / entry["path"]
        destination = payload / entry["path"]
        if entry["kind"] == "file":
            no_link_ancestors(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            if digest(destination) != entry["sha256"]:
                raise ValueError("Checkpoint copy changed; incomplete checkpoint retained")
        elif entry["kind"] == "directory":
            destination.mkdir(parents=True, exist_ok=True)
    # Detect edits/additions/removals during the copy, including link changes.
    if inventory(root) != entries:
        raise ValueError("Live trees changed; incomplete checkpoint retained")
    manifest = {"schema": 1, "status": "verified", "root": str(root),
                "scope": list(MANAGED), "entries": entries}
    (staged / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    final = parent / token
    staged.rename(final)
    return final


def verify(root, checkpoint):
    root, checkpoint = Path(root).absolute(), Path(checkpoint).absolute()
    no_link_ancestors(checkpoint)
    if checkpoint.parent != root / "updates/hermes-checkpoints" or len(checkpoint.name) != 32:
        raise ValueError("Checkpoint does not belong to this instance")
    manifest = json.loads((checkpoint / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != 1 or manifest.get("status") != "verified" or manifest.get("scope") != list(MANAGED) or manifest.get("root") != str(root):
        raise ValueError("Checkpoint identity mismatch")
    seen = set()
    for entry in manifest["entries"]:
        name = entry["path"]
        parts = name.split("/")
        if any(part in ("", ".", "..") or ":" in part or "\\" in part for part in parts):
            raise ValueError("Unsafe checkpoint path")
        if not any(name == tree or name.startswith(tree + "/") for tree in MANAGED) or name.casefold() in seen:
            # Windows source may contain case-colliding tracked Git entries, but
            # disk inventory contains only the actual filesystem spelling.
            raise ValueError("Unapproved or duplicate checkpoint path")
        seen.add(name.casefold())
        candidate = checkpoint / "payload" / name
        no_link_ancestors(candidate)
        if entry["kind"] == "file":
            if candidate.stat().st_size != entry["bytes"] or digest(candidate) != entry["sha256"]:
                raise ValueError("Checkpoint payload hash mismatch")
        elif entry["kind"] == "directory":
            if not candidate.is_dir():
                raise ValueError("Checkpoint directory missing")
        elif entry["kind"] == "link":
            target = entry["target"]
            if Path(target).is_absolute() or any(part in ("", ".", "..") or ":" in part or "\\" in part for part in target.split("/")):
                raise ValueError("Unsafe link target")
        else:
            raise ValueError("Unknown checkpoint entry")
    for tree in MANAGED:
        if not any(item["path"] == tree and item["kind"] == "directory" for item in manifest["entries"]):
            raise ValueError("Checkpoint managed root missing")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("create", "verify"))
    parser.add_argument("--root", required=True)
    parser.add_argument("--checkpoint")
    args = parser.parse_args()
    try:
        if args.action == "create":
            result = create(args.root)
            verify(args.root, result)
            print("HERMES_CHECKPOINT_VERIFIED " + result.name)
        else:
            verify(args.root, args.checkpoint)
            print("HERMES_CHECKPOINT_VERIFIED")
    except Exception:
        print("Checkpoint failed verification. Live files were not restored or deleted; preserve any partial backup.")
        raise SystemExit(1)
