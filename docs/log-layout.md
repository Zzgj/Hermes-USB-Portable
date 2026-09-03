# Portable log layout

The top-level `logs/` directory is the Workbench-facing entry point for generated diagnostics. It does not make raw logs public or Git-tracked, and it does not move files that Hermes or the portable Runtime expect at their native locations.

## Workbench-owned directories

```text
logs/
├── initializer/   environment-check-*.json
├── launcher/      events.jsonl
├── setup/         setup-*.log
├── doctor/        doctor-*.log
├── diagnostics/   update-check-*.log and update-plan-*.log
└── exports/       future explicitly generated, redacted evidence bundles
```

The initializer and launchers create these directories repeatedly without deleting existing files. Windows setup uses a PowerShell transcript. Doctor, update check, and update plan receive their own timestamped transcripts. The interactive Hermes update itself is not piped through a custom transcript because doing so could change terminal detection or prompt behavior; its authoritative structured result remains the official update receipt.

## Native canonical sources

Some operational records are state owned by another component and must remain where that component expects them:

| Source | Canonical portable-relative location | Reason it is not moved |
|---|---|---|
| Hermes/Gateway logs | `data/logs/` | Owned and rotated by Hermes under `HERMES_HOME` |
| Hermes update receipts | `data/logs/update_receipts/` | Written and consumed by the official updater and Desktop |
| Runtime manifest | `.cache/runtimes/{platform}-{arch}/runtime-manifest.json` | Describes the installed platform Runtime, not an append-only log |
| Hermes source state | `src/hermes-agent/.portable-source.json` | Travels with the installed source checkout |

`manifests/log-sources.json` is the machine-readable catalog for the future log UI. The UI should resolve every catalog path relative to the portable root and present Workbench-owned and native sources through one view. It must not assume that every source is physically copied under `logs/`.

## Logs versus live state

Logs and receipts are historical evidence. Live state such as PID files, locks, active Sessions, credentials, databases, or mutable configuration does not belong under `logs/`. Moving that data merely to make a UI simpler would risk stale state and break upstream behavior. A future UI should read live state through Hermes interfaces and use the log catalog only for historical/diagnostic records.

## Privacy and sharing

Generated `logs/`, `data/`, `.cache/`, and `src/` remain excluded from Git. Raw transcripts may contain usernames, paths, profile names, network information, or command output and therefore are not automatically safe to share. Never include `.env`, `auth.json`, Sessions, private Memory, private Skills, or a private Vault in a diagnostic export. The future exporter must copy only an allowlist, redact sensitive values, and require user review before sharing.
