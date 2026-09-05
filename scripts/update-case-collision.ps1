# Transaction for the two known upstream Windows case-colliding paths only.
function Restore-HermesCollisionFiles {
    param($Transaction)
    if ($null -eq $Transaction) { return }
    foreach ($entry in $Transaction.files) {
        if (Test-Path -LiteralPath $entry.original) {
            if ((Get-FileHash -LiteralPath $entry.original).Hash -ne $entry.sha256) {
                throw "Collision restore would overwrite changed content. Backup retained: $($entry.backup)"
            }
        } else {
            if ((Get-FileHash -LiteralPath $entry.backup).Hash -ne $entry.sha256) {
                throw 'Collision backup hash mismatch; refusing restore.'
            }
            Copy-Item -LiteralPath $entry.backup -Destination $entry.original -ErrorAction Stop
        }
    }
}

function Protect-HermesUpdateCollision {
    param([string]$GitExecutable, [string]$SourceDirectory, [string]$TargetRef, [string]$BackupDirectory)
    $upper = 'contributors/emails/agent@Agents-Mac-mini.local'
    $lower = 'contributors/emails/agent@agents-Mac-mini.local'
    $head = @(& $GitExecutable -C $SourceDirectory ls-tree HEAD -- $upper $lower)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect collision source tree.' }
    if ($head.Count -ne 2) { return $null }
    # Refuse unknown historical variants; never silently discard arbitrary files.
    $known = @(
        "100644 blob 73bf022af1bb2b0aa6096bfa6924cd5d637b2442`t$upper",
        "100644 blob 850e0a4eb0797de44bc8d7913009a7f206dee57a`t$lower"
    )
    if (@(Compare-Object $head $known).Count -ne 0) {
        throw 'Unknown case-collision source variant; manual review required.'
    }
    $target = @(& $GitExecutable -C $SourceDirectory ls-tree $TargetRef -- $upper $lower)
    if ($LASTEXITCODE -ne 0) { throw 'Fetch/check updates before collision preparation.' }
    if ($target.Count -ne 1 -or $target[0] -notmatch ('^100644 blob [0-9a-f]{40}\t' + [regex]::Escape($lower) + '$')) {
        throw 'Target has not resolved the known case collision; refusing automatic preparation.'
    }
    & $GitExecutable -C $SourceDirectory diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Staged changes must be resolved before collision preparation.' }
    $flags = @(& $GitExecutable -C $SourceDirectory ls-files -v -- $upper $lower)
    if ($LASTEXITCODE -ne 0 -or @($flags | Where-Object { $_ -cmatch '^S ' }).Count -ne 2) {
        throw 'Expected bounded skip-worktree workaround is not active.'
    }
    $backupRoot = Join-Path $BackupDirectory ('case-collision-' + [Guid]::NewGuid().ToString('N'))
    $transaction = [pscustomobject]@{ schema_version = 1; files = @(); target = $TargetRef }
    # OrdinalIgnoreCase also deduplicates the two aliases on Windows.
    $comparer = [StringComparer]::Ordinal
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { $comparer = [StringComparer]::OrdinalIgnoreCase }
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ($comparer)
    foreach ($relative in @($upper, $lower)) {
        $path = Join-Path $SourceDirectory $relative
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Collision file is a link; refusing automatic preparation.' }
        foreach ($ancestor in @($SourceDirectory, (Join-Path $SourceDirectory 'contributors'), (Join-Path $SourceDirectory 'contributors/emails'))) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Collision directory is a link; refusing automatic preparation.' }
        }
        $identity = $item.FullName
        if (-not $seen.Add($identity)) { continue }
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $saved = Join-Path $backupRoot ($transaction.files.Count.ToString() + '.original')
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Copy-Item -LiteralPath $path -Destination $saved -ErrorAction Stop
        if ((Get-FileHash -LiteralPath $saved -Algorithm SHA256).Hash -ne $hash) { throw 'Collision backup verification failed.' }
        $transaction.files += [pscustomobject]@{ original = $path; backup = $saved; sha256 = $hash }
    }
    if ($transaction.files.Count -eq 0) { return $transaction }
    $transaction | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot 'transaction.json') -Encoding UTF8
    try {
        foreach ($entry in $transaction.files) {
            if ((Get-FileHash -LiteralPath $entry.original).Hash -ne $entry.sha256) { throw 'Collision file changed during backup.' }
            Remove-Item -LiteralPath $entry.original -ErrorAction Stop
        }
    } catch {
        Restore-HermesCollisionFiles $transaction
        throw
    }
    Write-Host "[portable-update] Case-collision originals preserved at: $backupRoot"
    return $transaction
}

function Complete-HermesCollisionUpdate {
    param([string]$GitExecutable, [string]$SourceDirectory, $Transaction)
    if ($null -eq $Transaction) { return }
    $lower = 'contributors/emails/agent@agents-Mac-mini.local'
    $upper = 'contributors/emails/agent@Agents-Mac-mini.local'
    $tree = @(& $GitExecutable -C $SourceDirectory ls-tree HEAD -- $upper $lower)
    if ($LASTEXITCODE -ne 0 -or $tree.Count -ne 1 -or $tree[0] -notmatch ('\t' + [regex]::Escape($lower) + '$')) {
        throw 'Updated checkout still has an unexpected collision; originals retained in backup.'
    }
    # The surviving blob may be unchanged between commits. Git can therefore
    # leave it absent while its old skip-worktree flag was set. Materialize only
    # an absent survivor, never force-overwrite a newly written file.
    if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory $lower))) {
        & $GitExecutable -C $SourceDirectory checkout-index -- $lower
        if ($LASTEXITCODE -ne 0) { throw 'Unable to materialize collision survivor; backup retained.' }
    }
}
