$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../scripts/hermes-restore-state.ps1"
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('hermes-restore-tests-' + [Guid]::NewGuid().ToString('N'))
try {
    foreach ($phase in @(0,1,2,3,4,5)) {
        $root = Join-Path $fixture "phase-$phase"
        $id = [Guid]::NewGuid().ToString('N')
        $transaction = Join-Path $root "updates/hermes-restores/$id"
        $trees = @('.cache/runtimes/windows-x64','src/hermes-agent')
        foreach ($tree in $trees) {
            New-Item -ItemType Directory -Path "$root/$tree", "$transaction/new/$tree" -Force | Out-Null
            [IO.File]::WriteAllText("$root/$tree/file", 'old')
            [IO.File]::WriteAllText("$transaction/new/$tree/file", 'new')
        }
        New-Item -ItemType Directory -Path "$root/data" -Force | Out-Null
        [IO.File]::WriteAllText("$root/data/sentinel", 'PRIVATE_DATA')
        if ($phase -eq 5) {
            Install-HermesRestore $root $id
            foreach ($tree in $trees) {
                Assert ([IO.File]::ReadAllText("$root/$tree/file") -eq 'new') 'New tree installed'
                Assert ([IO.File]::ReadAllText("$transaction/old/$tree/file") -eq 'old') 'Old tree retained'
            }
        } else {
            $journal = [ordered]@{schema=1;root=$root;transaction=$id;had_runtime=$true;had_source=$true}
            Write-RecoveryJournal $journal "$root/updates/hermes-restore-active.json"
            # Simulate process death at each boundary between the four renames.
            for ($index=0; $index -lt $phase; $index++) {
                $tree = $trees[[int][Math]::Floor($index/2)]
                if ($index % 2 -eq 0) {
                    New-Item -ItemType Directory -Path (Split-Path "$transaction/old/$tree" -Parent) -Force | Out-Null
                    Move-Item -LiteralPath "$root/$tree" -Destination "$transaction/old/$tree"
                } else { Move-Item -LiteralPath "$transaction/new/$tree" -Destination "$root/$tree" }
            }
            Undo-HermesRestore $root
            foreach ($tree in $trees) { Assert ([IO.File]::ReadAllText("$root/$tree/file") -eq 'old') 'Interrupted restore undo preserves original tree' }
        }
        Assert ([IO.File]::ReadAllText("$root/data/sentinel") -eq 'PRIVATE_DATA') 'User data unchanged'
        Assert (-not (Test-Path "$root/updates/hermes-restore-active.json")) 'Resolved journal cleared'
    }
    Write-Host 'Hermes restore transaction tests passed.'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
