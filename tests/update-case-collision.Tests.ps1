$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../scripts/update-case-collision.ps1"
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
$upper = 'contributors/emails/agent@Agents-Mac-mini.local'
$lower = 'contributors/emails/agent@agents-Mac-mini.local'
$script:targetSafe = $true
$script:staged = $false
function FakeGit {
    $global:LASTEXITCODE = 0
    $arguments = @($args)
    if ($arguments -contains 'ls-tree') {
        if ($arguments -contains 'HEAD' -or -not $script:targetSafe) {
            "100644 blob 73bf022af1bb2b0aa6096bfa6924cd5d637b2442`t$upper"
        }
        "100644 blob 850e0a4eb0797de44bc8d7913009a7f206dee57a`t$lower"
    } elseif ($arguments -contains 'ls-files') {
        "S $upper"
        "S $lower"
    } elseif ($arguments -contains 'diff' -and $script:staged) {
        $global:LASTEXITCODE = 1
    }
}
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('collision-tests-' + [Guid]::NewGuid().ToString('N'))
try {
    $repo = Join-Path $fixture 'repo'
    $backups = Join-Path $fixture 'backups'
    New-Item -ItemType Directory -Path "$repo/contributors/emails" -Force | Out-Null
    $file = Join-Path $repo $upper
    [IO.File]::WriteAllText($file, 'unrecognized user bytes must survive')
    $hash = (Get-FileHash $file).Hash
    $script:targetSafe = $false
    $rejected = $false
    try { Protect-HermesUpdateCollision FakeGit $repo origin/main $backups | Out-Null } catch { $rejected = $true }
    Assert $rejected 'Unsafe target must be rejected'
    Assert ((Get-FileHash $file).Hash -eq $hash) 'Preflight must preserve original'
    $script:targetSafe = $true
    $script:staged = $true
    $rejected = $false
    try { Protect-HermesUpdateCollision FakeGit $repo origin/main $backups | Out-Null } catch { $rejected = $true }
    Assert $rejected 'Staged changes must be rejected'
    $script:staged = $false
    $transaction = Protect-HermesUpdateCollision FakeGit $repo origin/main $backups
    Assert (-not (Test-Path $file)) 'Original should be moved out of checkout'
    Assert ((Get-FileHash $transaction.files[0].backup).Hash -eq $hash) 'Backup must preserve unknown content'
    Restore-HermesCollisionFiles $transaction
    Assert ((Get-FileHash $file).Hash -eq $hash) 'Failed/no-change update must restore original'
    [IO.File]::WriteAllText($file, 'new content after update')
    $rejected = $false
    try { Restore-HermesCollisionFiles $transaction } catch { $rejected = $true }
    Assert $rejected 'Restore must refuse overwriting changed content'
    Assert ([IO.File]::ReadAllText($file) -eq 'new content after update') 'New content must survive restore refusal'

    # Real Git regression: manufacture the exact historic blobs/index on both
    # case-sensitive Linux and ordinary case-insensitive Windows filesystems.
    $git = (Get-Command git -ErrorAction Stop).Source
    $real = Join-Path $fixture 'real-repo'
    New-Item -ItemType Directory -Path "$real/contributors/emails" -Force | Out-Null
    & $git init -q $real
    & $git -C $real config user.name fixture
    & $git -C $real config user.email fixture@example.invalid
    & $git -C $real config core.autocrlf false
    $blobFile = Join-Path $fixture 'blob'
    [IO.File]::WriteAllBytes($blobFile, [Convert]::FromBase64String('c2tpcC1hZ2VudAo='))
    $upperHash = (& $git -C $real hash-object -w --no-filters $blobFile).Trim()
    [IO.File]::WriteAllBytes($blobFile, [Convert]::FromBase64String('bW9tb21vam8K'))
    $lowerHash = (& $git -C $real hash-object -w --no-filters $blobFile).Trim()
    & $git -C $real update-index --add --cacheinfo "100644,$upperHash,$upper"
    & $git -C $real update-index --add --cacheinfo "100644,$lowerHash,$lower"
    $tree = (& $git -C $real write-tree).Trim()
    $oldCommit = (& $git -C $real commit-tree $tree -m old).Trim()
    & $git -C $real update-ref HEAD $oldCommit
    & $git -C $real update-index --force-remove -- $upper
    $tree = (& $git -C $real write-tree).Trim()
    $newCommit = (& $git -C $real commit-tree $tree -p $oldCommit -m new).Trim()
    & $git -C $real update-ref refs/remotes/origin/main $newCommit
    & $git -C $real read-tree $oldCommit
    [IO.File]::WriteAllText((Join-Path $real $upper), 'unrecognized original')
    & $git -C $real update-index --skip-worktree -- $upper $lower
    $tx = Protect-HermesUpdateCollision $git $real origin/main $backups
    & $git -C $real read-tree --dry-run -m -u HEAD origin/main
    Assert ($LASTEXITCODE -eq 0) 'Real Git dry-run should pass after preparation'
    & $git -C $real checkout -q -b updated origin/main
    Assert ($LASTEXITCODE -eq 0) 'Real Git checkout should succeed'
    . "$PSScriptRoot/../scripts/runtime-setup-state.ps1"
    Set-HermesCaseCollisionWorkaround $git $real | Out-Null
    Complete-HermesCollisionUpdate $git $real $tx
    $status = @(& $git -C $real status --porcelain)
    Assert ($status.Count -eq 0) 'Updated checkout should be clean'
    Assert (Test-Path -LiteralPath (Join-Path $real $lower)) 'Surviving tracked file should be materialized'
    Write-Host 'Update case collision tests passed.'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
