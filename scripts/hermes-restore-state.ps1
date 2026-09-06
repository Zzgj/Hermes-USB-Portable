function Assert-RecoveryBoundary([string]$Path) {
    $cursor = $Path
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Recovery boundary contains a link.' }
        $parent = Split-Path $cursor -Parent
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function Write-RecoveryJournal($Value, [string]$Path) {
    $temporary = $Path + '.tmp'
    Assert-RecoveryBoundary $Path
    Assert-RecoveryBoundary $temporary
    $Value | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}
function Undo-HermesRestore([string]$Root) {
    $marker = Join-Path $Root 'updates/hermes-restore-active.json'
    Assert-RecoveryBoundary $marker
    $state = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.schema -ne 1 -or $state.root -ne $Root -or $state.transaction -notmatch '^[0-9a-f]{32}$' -or $state.had_runtime -isnot [bool] -or $state.had_source -isnot [bool]) { throw 'Invalid recovery journal; no mutation allowed.' }
    $transaction = Join-Path $Root ('updates/hermes-restores/' + $state.transaction)
    foreach ($item in @(@('.cache/runtimes/windows-x64', $state.had_runtime), @('src/hermes-agent', $state.had_source))) {
        $relative = $item[0]
        $current = Join-Path $Root $relative
        $old = Join-Path $transaction ('old/' + $relative)
        $new = Join-Path $transaction ('new/' + $relative)
        $aborted = Join-Path $transaction ('aborted-new/' + $relative)
        foreach ($path in @($current,$old,$new,$aborted)) { Assert-RecoveryBoundary $path }
        if (Test-Path -LiteralPath $old) {
            if (Test-Path -LiteralPath $current) {
                if ((Test-Path -LiteralPath $new) -or (Test-Path -LiteralPath $aborted)) { throw 'Ambiguous recovery state; all files preserved.' }
                New-Item -ItemType Directory -Path (Split-Path $aborted -Parent) -Force | Out-Null
                Move-Item -LiteralPath $current -Destination $aborted
            }
            New-Item -ItemType Directory -Path (Split-Path $current -Parent) -Force | Out-Null
            Move-Item -LiteralPath $old -Destination $current
        } elseif (-not $item[1] -and (Test-Path -LiteralPath $current)) {
            if ((Test-Path -LiteralPath $new) -or (Test-Path -LiteralPath $aborted)) { throw 'Unexpected files appeared during recovery.' }
            New-Item -ItemType Directory -Path (Split-Path $aborted -Parent) -Force | Out-Null
            Move-Item -LiteralPath $current -Destination $aborted
        } elseif ($item[1] -and -not (Test-Path -LiteralPath $current)) {
            throw 'Original tree is missing; recovery requires manual review.'
        }
    }
    Copy-Item -LiteralPath $marker -Destination (Join-Path $transaction 'undone.json') -Force
    Remove-Item -LiteralPath $marker
}
function Install-HermesRestore([string]$Root, [string]$TransactionId) {
    if ($TransactionId -notmatch '^[0-9a-f]{32}$') { throw 'Invalid transaction ID.' }
    $transaction = Join-Path $Root ('updates/hermes-restores/' + $TransactionId)
    $marker = Join-Path $Root 'updates/hermes-restore-active.json'
    Assert-RecoveryBoundary $marker
    if (Test-Path -LiteralPath $marker) { throw 'Finish or undo the active restore first.' }
    foreach ($relative in @('.cache/runtimes/windows-x64', 'src/hermes-agent')) {
        Assert-RecoveryBoundary (Join-Path $Root $relative)
        Assert-RecoveryBoundary (Join-Path $transaction ('new/' + $relative))
        if (-not (Test-Path -LiteralPath (Join-Path $transaction ('new/' + $relative)) -PathType Container)) { throw 'Prepared tree missing.' }
    }
    $journal = [ordered]@{ schema=1; root=$Root; transaction=$TransactionId; had_runtime=(Test-Path -LiteralPath (Join-Path $Root '.cache/runtimes/windows-x64')); had_source=(Test-Path -LiteralPath (Join-Path $Root 'src/hermes-agent')) }
    Write-RecoveryJournal $journal $marker
    try {
        foreach ($relative in @('.cache/runtimes/windows-x64', 'src/hermes-agent')) {
            $current = Join-Path $Root $relative
            $old = Join-Path $transaction ('old/' + $relative)
            $new = Join-Path $transaction ('new/' + $relative)
            Assert-RecoveryBoundary $old
            if (Test-Path -LiteralPath $old) { throw 'Old-tree destination already exists.' }
            New-Item -ItemType Directory -Path (Split-Path $old -Parent) -Force | Out-Null
            if (Test-Path -LiteralPath $current) { Move-Item -LiteralPath $current -Destination $old }
            New-Item -ItemType Directory -Path (Split-Path $current -Parent) -Force | Out-Null
            Move-Item -LiteralPath $new -Destination $current
        }
        Copy-Item -LiteralPath $marker -Destination (Join-Path $transaction 'completed.json')
        Remove-Item -LiteralPath $marker
    } catch {
        Undo-HermesRestore $Root
        throw
    }
}
