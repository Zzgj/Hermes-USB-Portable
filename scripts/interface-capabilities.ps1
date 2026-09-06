function Get-PortableInterfaceCapabilities([string]$Root) {
    $source = Join-Path $Root 'src/hermes-agent'
    $format = 'Unknown'
    try {
        $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($Root))
        $format = $drive.DriveFormat
    } catch {}
    [ordered]@{
        FileSystem = $format
        WorkspaceLinksUnsupported = ($format -in @('exFAT', 'FAT', 'FAT32'))
        TUIAssets = Test-Path -LiteralPath (Join-Path $source 'ui-tui/node_modules')
        TUIWorkspaceLinked = Test-Path -LiteralPath (Join-Path $source 'node_modules/hermes-tui/package.json')
        SharedWorkspaceLinked = Test-Path -LiteralPath (Join-Path $source 'node_modules/@hermes/shared/package.json')
        WebAssets = Test-Path -LiteralPath (Join-Path $source 'hermes_cli/web_dist/index.html')
        # Existence is only a prerequisite, never proof that chat works.
        InteractiveChatVerified = $false
    }
}
