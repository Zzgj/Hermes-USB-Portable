"""Explicit, narrow repair for a local terminal cwd after a drive-letter change.

Never rewrite sessions, .env, remote paths, or arbitrary strings in YAML.
"""
import argparse
import copy
import io
import os
from pathlib import Path, PureWindowsPath
import re
import shutil
import tempfile
import uuid


def mapped_cwd(value, root):
    """Return a candidate only for the same portable folder on another drive."""
    if not isinstance(value, str):
        return None
    if re.match(r"^/[a-zA-Z]/", value):
        value = value[1] + ":/" + value[3:]
    old, new = PureWindowsPath(value), PureWindowsPath(root)
    if not re.fullmatch(r"[a-zA-Z]:", old.drive) or not new.is_absolute():
        return None
    if old.drive.lower() == new.drive.lower() or ".." in old.parts:
        return None
    # Folder renames and arbitrary project roots require human review.
    if len(old.parts) < len(new.parts):
        return None
    if tuple(p.lower() for p in old.parts[1:len(new.parts)]) != tuple(p.lower() for p in new.parts[1:]):
        return None
    return str(new.joinpath(*old.parts[len(new.parts):]))


def repair(root, apply=False):
    from ruamel.yaml import YAML

    root = Path(root).resolve()
    config = root / "data/config.yaml"
    # Do not follow user-data redirections when writing.
    for path in (root, root / "data", config):
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise ValueError("Linked configuration paths require manual review.")
        if path.exists() and getattr(path.stat(follow_symlinks=False), "st_file_attributes", 0) & 0x400:
            raise ValueError("Reparse-point configuration paths require manual review.")
    if not config.is_file():
        print("No configuration to repair.")
        return
    before = config.read_bytes()
    yaml = YAML()
    yaml.preserve_quotes = True
    data = yaml.load(before.decode("utf-8-sig")) or {}
    terminal = data.get("terminal", {}) or {}
    if terminal.get("backend", terminal.get("env_type", "local")) != "local":
        print("Remote backend preserved; no repair applied.")
        return
    value = terminal.get("cwd")
    candidate = mapped_cwd(value, str(root))
    if candidate is None:
        print("No unambiguous drive-letter repair found. Configuration unchanged.")
        return
    if not Path(candidate).is_dir():
        raise ValueError("Mapped directory does not exist; configuration unchanged.")
    print("A local terminal.cwd points to this portable folder on another drive.")
    if not apply:
        print("Review only. Use -Apply from the repair menu to confirm the change.")
        return
    if input("Repair only terminal.cwd? A private config backup will be retained. Type yes: ").strip() != "yes":
        print("Cancelled; configuration unchanged.")
        return
    terminal = copy.deepcopy(terminal)
    terminal["cwd"] = candidate
    data["terminal"] = terminal
    stream = io.StringIO()
    yaml.dump(data, stream)
    after = stream.getvalue().encode("utf-8")
    # Keep the backup adjacent, avoiding redirects through a logs directory.
    backup = config.with_name("config.yaml.pre-cwd-repair-" + uuid.uuid4().hex)
    if config.read_bytes() != before:
        raise ValueError("Configuration changed during review; retry without overwriting it.")
    with backup.open("xb") as handle:
        handle.write(before)
    if backup.read_bytes() != before:
        raise ValueError("Backup verification failed; configuration unchanged.")
    descriptor, staged = tempfile.mkstemp(prefix=".cwd-repair-", dir=config.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(after)
        shutil.copymode(config, staged)
        if config.read_bytes() != before:
            raise ValueError("Configuration changed; refusing replacement.")
        os.replace(staged, config)
    finally:
        if os.path.exists(staged):
            os.unlink(staged)
    print("TERMINAL_CWD_REPAIRED. Private backup retained alongside config.yaml.")
    print("Start a new chat to verify. Stored session directories were not modified.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        repair(args.root, args.apply)
    except Exception:
        # YAML exception text can include secrets from the configuration.
        print("Cwd repair could not complete. Preserve configuration and any adjacent backup; manual review required.")
        raise SystemExit(1)
