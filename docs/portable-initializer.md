# Minimal portable environment initializer

The P0 initializer creates an empty Portable AI Workbench layout in an explicitly selected ordinary directory. It does not install Hermes, download runtimes, configure credentials, request elevation, format storage, or install printers.

## Run on Windows

Use Windows PowerShell 5.1 or PowerShell 7:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\initialize-portable.ps1 -TargetDirectory "D:\Portable AI Test"
```

The target must be a dedicated directory, not a filesystem root such as `D:\`. A missing target directory is created. Existing directories and files are preserved. Symbolic links and Windows reparse points inside the managed layout are rejected so the initializer cannot write outside the selected directory through a linked path.

## Outputs

- The standard `runtime`, `data`, `knowledge`, `skills`, `repository`, `proxy`, `workspace`, `logs`, and `updates` directory tree.
- `portable-ai.manifest.json`, created once and never overwritten by the initializer.
- A unique `logs/initializer/environment-check-*.json` report for each run.

The report records the target path, filesystem and free-space information when available, write access, created and preserved directories, failures, warnings, and explicit safety flags.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Initialization succeeded. Warnings may still be present in the report. |
| `1` | An operation failed or the report could not be written. |
| `2` | The target argument is invalid, is a file, or points to a filesystem root. |

## Repeatability and data preservation

On repeat runs, existing directories, the version manifest, and every user file are left unchanged. Each run writes a new environment report instead of replacing an earlier report. A path collision, such as a regular file named `runtime`, is preserved and reported as a failure.

## Tests

Run the dependency-free test script from PowerShell:

```powershell
pwsh -NoProfile -File .\tests\portable-initializer.Tests.ps1
```

The test covers creation of a missing target, a path containing spaces and non-ASCII characters, repeat execution, preservation of a sentinel user file and the manifest, file/directory and symbolic-link collisions, identifiable failure reports, and rejection of filesystem roots.

GitHub Actions runs the same parser and behavior tests on `windows-latest` with both Windows PowerShell and PowerShell 7. The workflow has read-only repository permissions and pins the checkout action to a reviewed commit.
