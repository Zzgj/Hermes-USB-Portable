# P0 工程参考

本文件合并原实现说明、初始化器和日志布局；当前操作顺序只看 [验收](ACCEPTANCE.md)，阶段状态只看 [进度](PROGRESS.md)。历史版本说明不表示本轮重新验收。

## 实现与限制

### User-reported acceptance evidence

- NTFS USB CLI, TUI and Web messaging work.
- Moving to a second Windows computer changed the drive from F to E; Web
  messages still work. This is evidence for Web portability, not all tools.
- Terminal commands in the reported session initially tried the old `/f/...`
  cwd. Explicit cwd bypass worked. The owning setting/session field has not
  yet been identified, so no automatic user-data rewrite is justified.
- The agent ran `uv sync` and installed development extras into source `.venv`.
  This is not a required portable acceptance step. Do not delete it automatically.
- Ctrl+C can return to the outer batch prompt. The dedicated owned Web stop
  action passed Windows CI in run 34045256254; real-server confirmation remains
  part of the final combined acceptance. Port closure alone is not a process-tree audit.

### Changes under validation

- All Windows launcher Python invocations use the explicit portable venv
  executable, including gateway launch. PATH lookup cannot silently select a
  different Python for those invocations.
- TERMINAL_CWD is seeded from the current root at each launcher invocation.
  Upstream configuration and session restoration can override it; this does
  not claim to repair every persisted old path.
- Redacted read-only context diagnostics inspect local terminal.cwd existence,
  other-drive references, extra source `.venv`, and the probe interpreter prefix.
  Remote backend directories are not tested against the local filesystem.
- Interface diagnostics report workspace prerequisites separately from core
  health. They never certify interactive chat without an actual user test.
- FAT/exFAT graphical/TUI entrypoints fail early with an NTFS explanation,
  instead of triggering repeated unsuccessful workspace installation.

### Outstanding release gates

1. Native Windows PowerShell 5.1/7 passed run 34045256254 for commit 3eaa102.
   Additional finalization changes must pass the same gates before RC2 packaging.
2. Use the context report to identify the old-cwd source; inspect session
   metadata only if config checks do not explain it. Do not bulk-replace paths
   in conversations, .env, databases or source code.
3. Validate the owned Web service controller on Windows: Web opens in a separate
   console; typing STOP in Workbench force-terminates only that owned process
   tree. Finish chats first. This is not graceful chat finalization. Closing or
   interrupting the controller itself does not guarantee Web has stopped.
4. Produce a new integrated, hash-verified candidate after these gates; do not
   label this work-in-progress as final P0 acceptance or a completed RC2.

Diagnostic reports omit config contents and actual cwd values. Configuration
read errors are reported as unreadable rather than printed with secret-bearing
parser context. Extra development environments are only detected, not removed.

### Narrow cwd repair

Workbench option 9 reviews the default profile's local `terminal.cwd`. It only
maps an unchanged portable folder path from another drive onto the current one,
including `/f/...` Git Bash syntax. It requires the target directory to exist and
an explicit `yes`. It preserves comments and other YAML values and retains a
byte-verified private backup adjacent to config.yaml. Do not share this backup:
configuration can contain credentials. Cancelling leaves configuration intact.

Option 9 separately offers session cwd metadata repair with another explicit
confirmation. It applies the same narrow drive mapping, backs up SQLite before
mutation, and updates only matching cwd cells in one transaction. Conversation
messages remain unchanged. The backup contains private sessions; do not share it.
Close instance processes before applying either repair.

Renamed folders, remote backends, arbitrary projects and .env entries are not
rewritten. Do not run `uv sync` or modify upstream tests as a substitute for
relocation repair. The combined RC2 checklist is in [ACCEPTANCE.md](ACCEPTANCE.md).

### Verified shell rollback

`scripts/restore-p0-package.ps1 -Target <instance> -Backup <installation-backup>`
preflights every manifest entry and requires confirmation. Run it from the
extracted package, after closing launchers and target processes. Only the
package's approved shell paths can be restored. Links, traversal, tampered
backups and files changed since installation are refused before mutation.

The current shell is copied and hash-verified into a new
`logs/diagnostics/p0-shell-restore-undo-*` directory first. Old files are restored;
files newly introduced by the package are removed with recoverable copies in
undo. Runtime, Hermes source, data and knowledge are not touched. This is shell
rollback, **not** a substitute for a Hermes source/dependency rollback.

### Remaining evidence separation

Context diagnostics now report legacy cwd variables in .env and count distinct
session cwd values eligible for drive mapping. The SQLite connection is read-only;
the report includes no IDs, paths or conversation content. These findings help
identify which layer needs repair; they do not imply that sessions were repaired.

### Kernel recovery implementation in progress

`hermes-checkpoint.py` currently creates and verifies offline copies of the two
managed trees (Runtime and Hermes source). It checks hashes and inventories
before publishing a verified checkpoint. Workspace links are stored as metadata,
never traversed into the backup; links outside the instance are refused. Data,
knowledge and sessions are not included. Checkpoints may contain sensitive Git
configuration and must remain private.

Update apply now requires a verified checkpoint before invoking the official
updater and records its ID in the portable receipt. The manager refuses running
instance executables. Checkpoint creation is read-only with respect to the live
trees; insufficient space or changes during copying abort the update.

`manage-hermes-checkpoint.ps1 -Mode Restore -Root <root> -CheckpointId <id>`
requires confirmation, verifies/stages payloads, and then exchanges only the two
managed directories after Python has exited. Original directories remain in the
transaction's `old` directory. User data is not rolled back; this avoids erasing
new conversations, but application-level data migrations may need separate review.

An active restore marker blocks launch, Setup and update. `-Mode Undo` restores
the pre-attempt trees using the on-disk journal, without requiring Python to run.
The journal is written before any exchange. Automated fixtures interrupt every
rename boundary and check data sentinels. Native Windows junction creation and
staging are included in CI. These changes still require successful native CI and
the final combined real-instance recovery acceptance before a release claim.

## 初始化器

The P0 initializer creates an empty Portable AI Workbench layout in an explicitly selected ordinary directory. It does not install Hermes, download runtimes, configure credentials, request elevation, format storage, or install printers.

### Run on Windows

Use Windows PowerShell 5.1 or PowerShell 7:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\initialize-portable.ps1 -TargetDirectory "D:\Portable AI Test"
```

The target must be a dedicated directory, not a filesystem root such as `D:\`. A missing target directory is created. Existing directories and files are preserved. Symbolic links and Windows reparse points inside the managed layout are rejected so the initializer cannot write outside the selected directory through a linked path.

### Outputs

- The standard `runtime`, `data`, `knowledge`, `skills`, `repository`, `proxy`, `workspace`, `logs`, and `updates` directory tree. The log tree includes dedicated `initializer`, `launcher`, `setup`, `doctor`, `diagnostics`, and `exports` directories.
- `portable-ai.manifest.json`, created once and never overwritten by the initializer. It records the Windows Runtime bootstrap components, the exact SHA-256 of the component lock used, and the policy allowing explicit Hermes updates beyond the recorded bootstrap version.
- A unique `logs/initializer/environment-check-*.json` report for each run.

The report records the target path, filesystem and free-space information when available, write access, created and preserved directories, failures, warnings, and explicit safety flags.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Initialization succeeded. Warnings may still be present in the report. |
| `1` | An operation failed or the report could not be written. |
| `2` | The target argument is invalid, is a file, or points to a filesystem root. |
| `3` | The tracked runtime component lock is missing or invalid; the target is not modified. |

### Repeatability and data preservation

On repeat runs, existing directories, the version manifest, and every user file are left unchanged. Each run writes a new environment report instead of replacing an earlier report. A path collision, such as a regular file named `runtime`, is preserved and reported as a failure.

### Tests

Run the dependency-free test script from PowerShell:

```powershell
pwsh -NoProfile -File .\tests\portable-initializer.Tests.ps1
pwsh -NoProfile -File .\tests\runtime-component-lock.Tests.ps1
pwsh -NoProfile -File .\tests\runtime-filesystem.Tests.ps1
pwsh -NoProfile -File .\tests\runtime-setup-state.Tests.ps1
pwsh -NoProfile -File .\tests\portable-launcher.Tests.ps1
pwsh -NoProfile -File .\tests\reset-windows.Tests.ps1
pwsh -NoProfile -File .\tests\log-layout.Tests.ps1
```

The tests cover component-lock validation, staged Runtime move retry and verified copy fallback, atomic component receipts and corrupt-receipt recovery, soft-reset confirmation and data-preservation boundaries, creation of a missing target, a path containing spaces and non-ASCII characters, repeat execution, preservation of sentinel user files and the manifest, file/directory and symbolic-link collisions, identifiable failure reports, and rejection of filesystem roots.

GitHub Actions runs the same parser and behavior tests on `windows-latest` with both Windows PowerShell and PowerShell 7. The workflow has read-only repository permissions and pins the checkout action to a reviewed commit.

## 日志布局

The top-level `logs/` directory is the Workbench-facing entry point for generated diagnostics. It does not make raw logs public or Git-tracked, and it does not move files that Hermes or the portable Runtime expect at their native locations.

### Workbench-owned directories

```text
logs/
├── initializer/   environment-check-*.json
├── launcher/      events.jsonl
├── setup/         setup-*.log
├── doctor/        doctor-*.log
├── diagnostics/   update-check/plan/apply transcripts and safe apply receipts
└── exports/       future explicitly generated, redacted evidence bundles
```

The initializer and launchers create these directories repeatedly without deleting existing files. Windows setup uses a PowerShell transcript. Doctor, update check, update plan, and update apply receive their own timestamped transcripts. Windows update apply uses `Start-Transcript`, not an output pipeline, so the official updater keeps its interactive input and terminal behavior. The official receipt remains authoritative; the adjacent `update-apply-*.json` file is a Portable summary limited to version, commit, channel, status, paths from the public catalog, and safety flags.

### Native canonical sources

Some operational records are state owned by another component and must remain where that component expects them:

| Source | Canonical portable-relative location | Reason it is not moved |
|---|---|---|
| Hermes/Gateway logs | `data/logs/` | Owned and rotated by Hermes under `HERMES_HOME` |
| Hermes update receipts | `data/logs/update_receipts/` | Written and consumed by the official updater and Desktop |
| Portable update summaries | `logs/diagnostics/update-apply-*.json` | Links the official receipt and Runtime state without copying argv, config, profiles, or step details |
| Runtime manifest | `.cache/runtimes/{platform}-{arch}/runtime-manifest.json` | Describes the installed platform Runtime, not an append-only log |
| Hermes source state | `.cache/runtimes/{platform}-{arch}/hermes-source.json` | Owned by the Portable Runtime and deliberately kept outside the upstream Git worktree |

`manifests/log-sources.json` is the machine-readable catalog for the future log UI. The UI should resolve every catalog path relative to the portable root and present Workbench-owned and native sources through one view. It must not assume that every source is physically copied under `logs/`.

### Logs versus live state

Logs and receipts are historical evidence. Live state such as PID files, locks, active Sessions, credentials, databases, or mutable configuration does not belong under `logs/`. Moving that data merely to make a UI simpler would risk stale state and break upstream behavior. A future UI should read live state through Hermes interfaces and use the log catalog only for historical/diagnostic records.

### Privacy and sharing

Generated `logs/`, `data/`, `.cache/`, and `src/` remain excluded from Git. Raw transcripts may contain usernames, paths, profile names, network information, or command output and therefore are not automatically safe to share. Portable `update-apply-*.json` summaries are designed not to copy credentials or raw configuration, but must still be reviewed before sharing. Never include `.env`, `auth.json`, Sessions, private Memory, private Skills, or a private Vault in a diagnostic export. The future exporter must copy only an allowlist, redact sensitive values, and require user review before sharing.
