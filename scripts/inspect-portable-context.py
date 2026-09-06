"""Read-only, redacted context checks; never import Hermes or edit user state."""
import json
import os
from pathlib import Path, PureWindowsPath
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
    return result


if __name__ == "__main__":
    print(json.dumps(inspect(sys.argv[1])))
