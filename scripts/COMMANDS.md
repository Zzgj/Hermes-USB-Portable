# Hermes Portable — Command Reference

## Portable AI Directory Initializer

The initializer creates the standard Portable AI directory layout, a version manifest, and an environment report. It does not download runtimes, request administrator access, format storage, or install printers.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\initialize-portable.ps1 -TargetDirectory "D:\Portable AI Test"
```

Run its dependency-free behavior tests with Windows PowerShell 5.1 or PowerShell 7:

```powershell
.\tests\portable-initializer.Tests.ps1
.\tests\runtime-component-lock.Tests.ps1
```

See [`docs/portable-initializer.md`](../docs/portable-initializer.md) for output files, safety behavior, and exit codes.

## Windows Runtime Component Lock

`manifests/runtime-components.windows-x64.json` is the reviewed source of truth for the Windows x64 Runtime. `scripts/setup-windows.ps1` verifies the exact byte size and SHA-256 of every downloaded archive, fetches Hermes by a pinned tag, verifies the exact Git commit, and only writes `ready.flag` after recording `runtime-manifest.json`.

Run the static lock/setup contract test without downloading or installing anything:

```powershell
pwsh -NoProfile -File .\tests\runtime-component-lock.Tests.ps1
```

Do not use `hermes update` on a lock-managed Runtime. Update and review the component lock, run both test scripts, and rebuild the managed Runtime instead.

## Portable Launcher Commands

These are the commands you type in your terminal / PowerShell.

### Windows (`launch.bat`)

| Command | What it does |
|---------|-------------|
| `launch.bat` | Start Hermes TUI (chat interface) |
| `launch.bat hermes` | Same as above |
| `launch.bat setup` | Run setup wizard |
| `launch.bat hermes setup` | Same as above |
| `launch.bat gateway` | Start messaging gateway (Telegram, etc.) |
| `launch.bat hermes gateway` | Same as above |
| `launch.bat hermes gateway restart` | Restart gateway |
| `launch.bat hermes gateway stop` | Stop gateway |
| `launch.bat hermes doctor` | Check for issues |
| `launch.bat hermes status` | Show current status |
| `launch.bat hermes config` | View current config |
| `launch.bat hermes config edit` | Edit config in default editor |
| `launch.bat hermes chat` | Start chat mode |
| `launch.bat hermes update` | Upstream floating update; do not use for a lock-managed Runtime |

### macOS / Linux (`launch.sh`)

| Command | What it does |
|---------|-------------|
| `./launch.sh` | Start Hermes TUI |
| `./launch.sh setup` | Run setup wizard |
| `./launch.sh gateway` | Start messaging gateway |
| `./launch.sh hermes doctor` | Check for issues |
| `./launch.sh hermes status` | Show status |
| `./launch.sh hermes config` | View config |
| `./launch.sh hermes update` | Upstream floating update; do not use for a lock-managed Runtime |

---

## Reset Scripts (for testing / fresh starts)

Located in `scripts/` folder.

### Windows
```powershell
cd scripts
.\reset-windows.ps1 -Mode soft     # Keep data (API keys, config)
.\reset-windows.ps1 -Mode full     # Delete everything
```

### macOS / Linux
```bash
cd scripts
bash reset-unix.sh soft             # Keep data
bash reset-unix.sh full             # Full wipe
```

---

## Hermes CLI Commands

These work inside `launch.bat` / `launch.sh` after `hermes`.

### Core
```bash
hermes                      # Start TUI chat
hermes chat                 # Same
hermes --version            # Show version
hermes -z "your prompt"     # One-shot prompt (no TUI)
```

### Setup & Config
```bash
hermes setup                # Full interactive wizard
hermes setup model          # Change model/provider only
hermes setup terminal       # Change terminal backend
hermes setup gateway        # Configure messaging platforms
hermes setup tools          # Configure tool providers
hermes setup agent          # Customize agent behavior
hermes config               # View current config
hermes config edit          # Open in editor
hermes config set <key> <value>   # Set a value
hermes config get <key>     # Get a value
```

### Gateway (Messaging)
```bash
hermes gateway              # Start gateway in foreground
hermes gateway run          # Same
hermes gateway run --replace # Replace existing instance
hermes gateway restart      # Stop + start
hermes gateway stop         # Stop running gateway
hermes gateway install      # Install as system service (auto-start on boot)
hermes gateway uninstall    # Remove system service
hermes gateway status       # Check if running
```

### Sessions
```bash
hermes sessions             # List sessions
hermes sessions --resume    # Resume last session
hermes --resume <name>      # Resume specific session
hermes --continue           # Continue last session
```

### Tools & Diagnostics
```bash
hermes doctor               # Run diagnostics
hermes dump                 # Dump debug info
hermes debug                # Debug mode
hermes logs                 # View logs
hermes backup               # Backup data
hermes checkpoints          # Manage checkpoints
```

### Skills & Memory
```bash
hermes skills               # List skills
hermes skills create        # Create new skill
hermes skills edit          # Edit skill
hermes memory               # Memory management
hermes curator              # Curator tools
```

### Other Commands
```bash
hermes model                # Model management
hermes fallback             # Fallback provider settings
hermes proxy                # Proxy settings
hermes lsp                  # LSP mode
hermes postinstall          # Post-install hooks
hermes whatsapp             # WhatsApp tools
hermes slack                # Slack tools
hermes send                 # Send message
hermes login                # Login to service
hermes logout               # Logout
hermes auth                 # Authentication
hermes cron                 # Cron jobs
hermes webhook              # Webhooks
hermes kanban               # Kanban board
hermes hooks                # Hooks management
hermes import               # Import data
hermes pairing              # Device pairing
hermes plugins              # Plugin management
hermes insights             # Analytics
hermes claw                 # OpenClaw import
hermes version              # Version info
hermes uninstall            # Uninstall
hermes acp                  # ACP tools
hermes profile              # Profile management
hermes completion           # Shell completion
hermes dashboard            # Dashboard
hermes mcp                  # MCP tools
hermes computer-use         # Computer use tools
```

---

## Telegram Bot Commands

Send these to your Hermes bot on Telegram.

| Command | What it does |
|---------|-------------|
| `/start` | Start chatting with Hermes |
| `/stop` | Cancel current task/agent turn |
| `/sethome` | Set this chat as your home channel (for cron/notifications) |
| Any text | Hermes processes it as a prompt |

---

## File Locations (Portable)

| File | Path | Purpose |
|------|------|---------|
| API Keys | `data/.env` | Secrets (DeepSeek, Telegram, etc.) |
| Settings | `data/config.yaml` | All Hermes configuration |
| Chat History | `data/sessions/` | Saved conversations |
| Logs | `data/logs/` | agent.log, errors.log, gateway.log |
| State DB | `data/state.db` | Gateway state & locks |
| Custom Prompt | `data/SOUL.md` | System prompt loaded on every launch |
