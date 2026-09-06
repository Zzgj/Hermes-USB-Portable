# P0 NTFS finalization (2026-09-07)

## User-reported acceptance evidence

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

## Changes under validation

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

## Outstanding release gates

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

## Narrow cwd repair

Workbench option 9 reviews the default profile's local `terminal.cwd`. It only
maps an unchanged portable folder path from another drive onto the current one,
including `/f/...` Git Bash syntax. It requires the target directory to exist and
an explicit `yes`. It preserves comments and other YAML values and retains a
byte-verified private backup adjacent to config.yaml. Do not share this backup:
configuration can contain credentials. Cancelling leaves configuration intact.

Renamed folders, remote backends, arbitrary projects, .env entries and stored
session directories are not rewritten. Start a new chat after a confirmed repair.
If only a resumed session still fails, preserve it for diagnosis; don't run
`uv sync` or modify upstream tests as a substitute for relocation repair.

## Verified shell rollback

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

## Remaining evidence separation

Context diagnostics now report legacy cwd variables in .env and count distinct
session cwd values eligible for drive mapping. The SQLite connection is read-only;
the report includes no IDs, paths or conversation content. These findings help
identify which layer needs repair; they do not imply that sessions were repaired.
