"""Read-only, redacted context checks; never import Hermes or edit user state."""
import json
from contextlib import closing
import importlib.util
import os
from pathlib import Path, PureWindowsPath
import sqlite3
import sys


def inspect(root):
    import yaml

    root = Path(root).resolve()
    source = root / "src/hermes-agent"
    result = {
        "ConfigReadable": True,
        "LocalTerminalCwdExists": True,
        "LocalTerminalCwdUsesOtherDrive": False,
        "SourceDevelopmentVenvPresent": (source / ".venv").exists(),
        "PortableInterpreterUsed": Path(sys.prefix).resolve() == (
            root / ".cache/runtimes/windows-x64/venv"
        ).resolve(),
        "SessionCwdScanSucceeded": True,
        "SessionCwdRepairCandidates": 0,
        "LegacyTerminalCwdInEnv": False,
    }
    try:
        config_path = root / "data/config.yaml"
        config = yaml.safe_load(config_path.read_text(encoding="utf-8-sig")) if config_path.exists() else {}
        terminal = (config or {}).get("terminal", {}) or {}
        if terminal.get("backend", terminal.get("env_type", "local")) == "local":
            cwd = terminal.get("cwd")
            if cwd and str(cwd) not in (".", "auto", "cwd"):
                value = os.path.expandvars(os.path.expanduser(str(cwd)))
                # Git Bash paths need translating before Windows existence checks.
                if len(value) >= 3 and value[0] == "/" and value[1].isalpha() and value[2] == "/":
                    value = value[1] + ":/" + value[3:]
                result["LocalTerminalCwdExists"] = Path(value).is_dir()
                old = PureWindowsPath(value)
                current = PureWindowsPath(str(root))
                result["LocalTerminalCwdUsesOtherDrive"] = bool(
                    old.drive and current.drive and old.drive.lower() != current.drive.lower()
                )
    except Exception:
        result["ConfigReadable"] = False
    # Report only presence/counts. Never emit session IDs, paths, prompts or keys.
    try:
        env_file = root / "data/.env"
        if env_file.is_file():
            result["LegacyTerminalCwdInEnv"] = any(
                line.strip().removeprefix("export ").startswith(("TERMINAL_CWD=", "MESSAGING_CWD="))
                for line in env_file.read_text(encoding="utf-8-sig").splitlines()
            )
    except Exception:
        result["ConfigReadable"] = False
    database = root / "data/state.db"
    if database.exists():
        try:
            spec = importlib.util.spec_from_file_location("cwd_mapping", Path(__file__).with_name("repair-terminal-cwd.py"))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            # mode=ro refuses creation or SQL updates; no Hermes migrations run.
            with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=2)) as connection:
                connection.execute("PRAGMA query_only=ON")
                for (cwd,) in connection.execute("SELECT DISTINCT cwd FROM sessions WHERE cwd IS NOT NULL"):
                    if module.mapped_cwd(cwd, str(root)) is not None:
                        result["SessionCwdRepairCandidates"] += 1
        except Exception:
            result["SessionCwdScanSucceeded"] = False
    return result


if __name__ == "__main__":
    print(json.dumps(inspect(sys.argv[1])))
