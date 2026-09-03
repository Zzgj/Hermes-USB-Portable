#!/bin/bash
# ============================================================================
# Hermes Agent - Portable Launcher (macOS / Linux)
# ============================================================================
# Terminal:   ./launch.sh
# macOS Finder: rename this file to "launch.command" for double-click support.
# On first run, it downloads ~600MB of runtime files automatically.
# Generated state and logs stay inside this portable folder.
# ============================================================================

set -e

# Resolve portable root (directory containing this script)
PORTABLE_ROOT="$(cd "$(dirname "$0")" && pwd)"
HERMES_HOME="$PORTABLE_ROOT/data"
CACHE_DIR="$PORTABLE_ROOT/.cache"
SRC_DIR="$PORTABLE_ROOT/src"
LOG_ROOT="$PORTABLE_ROOT/logs"

# ---------------------------------------------------------------------------
# Detect OS and architecture
# ---------------------------------------------------------------------------
OS_RAW="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "$OS_RAW" in
    Linux*)     PLATFORM="linux" ;;
    Darwin*)    PLATFORM="macos" ;;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
    *)
        echo "[ERROR] Unsupported operating system: $OS_RAW"
        exit 1
        ;;
esac

case "$ARCH_RAW" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
        echo "[ERROR] Unsupported architecture: $ARCH_RAW"
        exit 1
        ;;
esac

RUNTIME_DIR="$CACHE_DIR/runtimes/${PLATFORM}-${ARCH}"

portable_id() {
    if command -v md5sum >/dev/null 2>&1; then
        printf '%s' "$1" | md5sum | cut -c1-8
    elif command -v md5 >/dev/null 2>&1; then
        printf '%s' "$1" | md5 | cut -c1-8
    else
        basename "$1" | tr -cd '[:alnum:]' | cut -c1-8
    fi
}

log_event() {
    local component="$1"
    local event_name="$2"
    local event_status="$3"
    local event_dir="$LOG_ROOT/$component"
    local event_time
    mkdir -p "$event_dir"
    event_time="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf '{"schema_version":1,"at_utc":"%s","component":"%s","event":"%s","status":"%s"}\n' \
        "$event_time" "$component" "$event_name" "$event_status" >> "$event_dir/events.jsonl"
}

run_observation() {
    local category="$1"
    local file_prefix="$2"
    shift 2
    local log_dir="$LOG_ROOT/$category"
    local stamp
    local log_path
    local command_status
    mkdir -p "$log_dir"
    stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
    log_path="$log_dir/${file_prefix}-${stamp}-$$-${RANDOM}.log"
    set +e
    "$@" 2>&1 | tee "$log_path"
    command_status=${PIPESTATUS[0]}
    set -e
    echo "[portable-log] Transcript: $log_path"
    return "$command_status"
}

mkdir -p "$LOG_ROOT/launcher" "$LOG_ROOT/setup" "$LOG_ROOT/doctor" \
    "$LOG_ROOT/diagnostics" "$LOG_ROOT/exports"
log_event launcher launcher-start started

# ---------------------------------------------------------------------------
# First-run setup
# ---------------------------------------------------------------------------
if [ ! -f "$RUNTIME_DIR/ready.flag" ]; then
    echo ""
    echo "============================================"
    echo "    Hermes Portable - First Run Setup"
    echo "============================================"
    echo "  Platform: ${PLATFORM}-${ARCH}"
    echo "  This will download ~600MB of runtime files."
    echo "  Please be patient."
    echo "============================================"
    echo ""
    log_event setup runtime-setup started
    if ! run_observation setup setup bash "$PORTABLE_ROOT/scripts/setup-unix.sh" "$PORTABLE_ROOT"; then
        log_event setup runtime-setup failed
        echo ""
        echo "[ERROR] Setup failed. Please check your internet connection and try again."
        exit 1
    fi
    log_event setup runtime-setup succeeded
fi

# ---------------------------------------------------------------------------
# Environment isolation — keep everything inside the portable folder
# (except the venv, which must live on a local FS to avoid exFAT hardlink
# limitations — see scripts/setup-unix.sh for details)
# ---------------------------------------------------------------------------

# Read the venv path from the pointer file written during setup.
if [ -f "$RUNTIME_DIR/venv.path" ]; then
    VIRTUAL_ENV="$(cat "$RUNTIME_DIR/venv.path")"
else
    # Fallback for older setups that put the venv on the drive.
    VIRTUAL_ENV="$RUNTIME_DIR/venv"
fi

# If the venv is missing (e.g. after a reboot purged $TMPDIR), rebuild it.
if [ ! -x "$VIRTUAL_ENV/bin/python" ]; then
    echo ""
    echo "[INFO] Local venv not found (temp was likely cleared). Rebuilding ..."
    echo "       This is fast because packages are cached on the drive."
    UV_EXE="$RUNTIME_DIR/uv/uv"
    PYTHON_EXE="$RUNTIME_DIR/python/bin/python3"
    SRC_DIR="$PORTABLE_ROOT/src"

    if [ "$PLATFORM" = "macos" ]; then
        LOCAL_BASE="${TMPDIR:-/tmp}"
    else
        LOCAL_BASE="/tmp"
    fi

    DRIVE_ID="$(portable_id "$RUNTIME_DIR")"
    VIRTUAL_ENV="${LOCAL_BASE}/hermes-portable-venv-${DRIVE_ID}"
    export UV_CACHE_DIR="${LOCAL_BASE}/hermes-uv-cache-${DRIVE_ID}"
    mkdir -p "$UV_CACHE_DIR"

    # Save updated path
    echo "$VIRTUAL_ENV" > "$RUNTIME_DIR/venv.path"

    rm -rf "$VIRTUAL_ENV"
    if ! "$UV_EXE" venv "$VIRTUAL_ENV" --python "$PYTHON_EXE" --seed 2>/dev/null; then
        "$UV_EXE" venv "$VIRTUAL_ENV" --python "$PYTHON_EXE"
    fi
    if ! "$UV_EXE" pip install --python "$VIRTUAL_ENV/bin/python" --link-mode=copy \
        -e "$SRC_DIR/hermes-agent[all]" \
        "python-telegram-bot[webhooks]==22.6" 2>/dev/null; then
        "$VIRTUAL_ENV/bin/python" -m ensurepip --upgrade >/dev/null 2>&1 || true
        "$VIRTUAL_ENV/bin/python" -m pip install \
            -e "$SRC_DIR/hermes-agent[all]" \
            "python-telegram-bot[webhooks]==22.6" 2>/dev/null || true
    fi
    echo "[OK]    Venv rebuilt."
fi

export HERMES_HOME="$HERMES_HOME"
export VIRTUAL_ENV
export PATH="$VIRTUAL_ENV/bin:$RUNTIME_DIR/python/bin:$RUNTIME_DIR/node/bin:$RUNTIME_DIR/uv:$RUNTIME_DIR/bin:$PATH"
export PYTHONNOUSERSITE=1
export PYTHONHOME=""
export PYTHONPATH=""
export UV_NO_CONFIG=1
export UV_PYTHON="$RUNTIME_DIR/python/bin/python3"
export PLAYWRIGHT_BROWSERS_PATH="$RUNTIME_DIR/playwright"
export NODE_PATH="$RUNTIME_DIR/node/lib/node_modules"
export NPM_CONFIG_PREFIX="$RUNTIME_DIR/node"

# Prevent Node/npm from writing to host home directory
export HOME="$PORTABLE_ROOT/.cache/unix-home"
mkdir -p "$HOME"

# ---------------------------------------------------------------------------
# Launch Hermes
# ---------------------------------------------------------------------------
if [ ! -d "$SRC_DIR/hermes-agent" ]; then
    echo "[ERROR] Hermes source not found. Please delete .cache and try again."
    exit 1
fi

cd "$SRC_DIR/hermes-agent"

# Strip "hermes" from the start of arguments if user typed "launch.sh hermes setup"
if [ "$1" = "hermes" ] || [ "$1" = "HERMES" ]; then
    shift
fi

# If explicit arguments were passed, run Hermes directly (skip menu)
if [ $# -gt 0 ]; then
    log_event launcher direct-command started
    if hermes "$@"; then
        log_event launcher direct-command succeeded
        exit 0
    else
        direct_status=$?
        log_event launcher direct-command failed
        exit "$direct_status"
    fi
fi

# ---------------------------------------------------------------------------
# ANSI Colors
# ---------------------------------------------------------------------------
ESC='\033'
RESET="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"
CYAN="${ESC}[36m"
BRIGHT_CYAN="${ESC}[96m"
GREEN="${ESC}[32m"
BRIGHT_GREEN="${ESC}[92m"
YELLOW="${ESC}[33m"
BRIGHT_YELLOW="${ESC}[93m"
RED="${ESC}[31m"
BRIGHT_RED="${ESC}[91m"
WHITE="${ESC}[37m"
BRIGHT_WHITE="${ESC}[97m"
GRAY="${ESC}[90m"

# ---------------------------------------------------------------------------
# Status Detection
# ---------------------------------------------------------------------------
detect_status() {
    SETUP_STATUS="Not configured"
    SETUP_ICON="[x]"
    SETUP_COLOR="$RED"
    PROVIDER_NAME=""
    MODEL_NAME=""

    if [ -f "$HERMES_HOME/.env" ] && grep -q '^[A-Z].*=' "$HERMES_HOME/.env"; then
        SETUP_STATUS="Configured"
        SETUP_ICON="[OK]"
        SETUP_COLOR="$BRIGHT_GREEN"
    fi

    if [ -f "$HERMES_HOME/config.yaml" ]; then
        PROVIDER_NAME=$(grep '^  provider:' "$HERMES_HOME/config.yaml" | head -n 1 | awk '{print $2}' || true)
        MODEL_NAME=$(grep '^  default:' "$HERMES_HOME/config.yaml" | head -n 1 | awk '{print $2}' || true)
    fi

    GATEWAY_STATUS="Stopped"
    GATEWAY_ICON="[ ]"
    GATEWAY_COLOR="$GRAY"
    GATEWAY_PID=""

    if [ -f "$HERMES_HOME/gateway.pid" ]; then
        GATEWAY_PID=$(grep -o '"pid":[0-9]*' "$HERMES_HOME/gateway.pid" | grep -o '[0-9]*' || true)
    fi

    if [ -n "$GATEWAY_PID" ]; then
        if kill -0 "$GATEWAY_PID" 2>/dev/null; then
            GATEWAY_STATUS="Running (PID $GATEWAY_PID)"
            GATEWAY_ICON="[OK]"
            GATEWAY_COLOR="$BRIGHT_GREEN"
        else
            GATEWAY_STATUS="Stopped (stale lock)"
            GATEWAY_ICON="[!]"
            GATEWAY_COLOR="$YELLOW"
        fi
    fi

    HERMES_VERSION="unknown"
    if [ -f "$SRC_DIR/hermes-agent/hermes_cli/__init__.py" ]; then
        HERMES_VERSION=$(grep '__version__' "$SRC_DIR/hermes-agent/hermes_cli/__init__.py" | head -n 1 | sed 's/.*"\(.*\)".*/\1/')
    fi
}

# ---------------------------------------------------------------------------
# Main Menu
# ---------------------------------------------------------------------------
show_menu() {
    clear
    echo ""
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo -e "${BOLD}${BRIGHT_WHITE}                    HERMES PORTABLE LAUNCHER${RESET}"
    echo -e "${DIM}${GRAY}                         AI Agent for Everyone${RESET}"
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo ""
    echo -e " ${DIM}Setup${RESET}    ${SETUP_COLOR}${SETUP_ICON}${RESET} ${WHITE}${SETUP_STATUS}${RESET}"
    [ -n "$PROVIDER_NAME" ] && echo -e " ${DIM}Provider${RESET} ${CYAN}${PROVIDER_NAME}${RESET}"
    [ -n "$MODEL_NAME" ] && echo -e " ${DIM}Model${RESET}    ${WHITE}${MODEL_NAME}${RESET}"
    echo -e " ${DIM}Gateway${RESET}  ${GATEWAY_COLOR}${GATEWAY_ICON}${RESET} ${WHITE}${GATEWAY_STATUS}${RESET}"
    echo -e " ${DIM}Version${RESET}  ${GRAY}v${HERMES_VERSION}${RESET}"
    echo ""
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo ""
    echo -e "  ${BRIGHT_YELLOW}[1]${RESET}  ${WHITE}Start Hermes Chat${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[2]${RESET}  ${WHITE}Setup / Reconfigure Hermes${RESET}"
    if [ "$GATEWAY_STATUS" = "Running (PID $GATEWAY_PID)" ]; then
        echo -e "  ${BRIGHT_YELLOW}[3]${RESET}  ${WHITE}Stop Gateway${RESET}  ${RED}[live]${RESET}"
    else
        echo -e "  ${BRIGHT_YELLOW}[3]${RESET}  ${WHITE}Start Gateway${RESET}"
    fi
    echo -e "  ${BRIGHT_YELLOW}[4]${RESET}  ${WHITE}Advanced Options${RESET}  ${GRAY}-->${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[5]${RESET}  ${GRAY}Exit${RESET}"
    echo ""
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo ""
    read -p "$(echo -e "${BRIGHT_CYAN}Select option: ${RESET}")" choice

    case "$choice" in
        1) menu_chat ;;
        2) menu_setup ;;
        3) menu_gateway ;;
        4) show_advanced ;;
        5) menu_exit ;;
        *) show_menu ;;
    esac
}

menu_chat() {
    clear
    log_event launcher chat started
    if hermes; then
        log_event launcher chat succeeded
    else
        log_event launcher chat failed
    fi
    show_menu
}

menu_setup() {
    clear
    log_event launcher hermes-setup started
    if hermes setup; then
        log_event launcher hermes-setup succeeded
    else
        log_event launcher hermes-setup failed
    fi
    detect_status
    show_menu
}

menu_gateway() {
    if [ "$GATEWAY_STATUS" = "Running (PID $GATEWAY_PID)" ]; then
        log_event launcher gateway-stop started
        if hermes gateway stop; then
            log_event launcher gateway-stop succeeded
        else
            log_event launcher gateway-stop failed
        fi
        echo ""
        echo -e "${BRIGHT_GREEN}Gateway stopped.${RESET}"
    else
        echo ""
        echo -e "${CYAN}Starting gateway in background ...${RESET}"
        log_event launcher gateway-start started
        hermes gateway &
        log_event launcher gateway-start observed
        sleep 2
    fi
    read -p "Press Enter to continue ..."
    detect_status
    show_menu
}

menu_exit() {
    log_event launcher launcher-exit observed
    clear
    echo ""
    echo -e "${GRAY}Goodbye!${RESET}"
    echo ""
    exit 0
}

# ---------------------------------------------------------------------------
# Advanced Menu
# ---------------------------------------------------------------------------
show_advanced() {
    clear
    echo ""
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo -e "${BOLD}${BRIGHT_WHITE}                       Advanced Options${RESET}"
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo ""
    echo -e "  ${BRIGHT_YELLOW}[1]${RESET}  ${WHITE}Run Doctor${RESET}            ${GRAY}- check for issues${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[2]${RESET}  ${WHITE}View Logs${RESET}             ${GRAY}- central paths + gateway tail${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[3]${RESET}  ${WHITE}Edit Config${RESET}           ${GRAY}- open in editor${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[4]${RESET}  ${WHITE}Restart Gateway${RESET}       ${GRAY}- stop + start${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[5]${RESET}  ${WHITE}Check for Updates${RESET}      ${GRAY}- read-only${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[6]${RESET}  ${WHITE}Update Hermes${RESET}         ${GRAY}- review + confirm${RESET}"
    echo -e "  ${BRIGHT_YELLOW}[7]${RESET}  ${GRAY}Back to Main Menu${RESET}"
    echo ""
    echo -e "${BRIGHT_CYAN}----------------------------------------------------------------${RESET}"
    echo ""
    read -p "$(echo -e "${BRIGHT_CYAN}Select option: ${RESET}")" choice

    case "$choice" in
        1) adv_doctor ;;
        2) adv_logs ;;
        3) adv_config ;;
        4) adv_restart ;;
        5) adv_update_check ;;
        6) adv_update ;;
        7) show_menu ;;
        *) show_advanced ;;
    esac
}

adv_doctor() {
    clear
    log_event doctor doctor started
    if run_observation doctor doctor hermes doctor; then
        log_event doctor doctor succeeded
    else
        log_event doctor doctor failed
    fi
    read -p "Press Enter to continue ..."
    show_advanced
}

adv_logs() {
    clear
    echo -e "${CYAN}Workbench logs:${RESET} $LOG_ROOT"
    echo -e "${CYAN}Hermes logs:${RESET}    $HERMES_HOME/logs"
    echo -e "${CYAN}Log catalog:${RESET}    $PORTABLE_ROOT/manifests/log-sources.json"
    echo ""
    if [ -f "$HERMES_HOME/logs/gateway.log" ]; then
        echo -e "${CYAN}=== Gateway Log (last 20 lines) ===${RESET}"
        tail -n 20 "$HERMES_HOME/logs/gateway.log"
    else
        echo -e "${YELLOW}No logs found.${RESET}"
    fi
    echo ""
    read -p "Press Enter to continue ..."
    show_advanced
}

adv_config() {
    clear
    hermes config edit
    show_advanced
}

adv_restart() {
    hermes gateway restart
    echo ""
    echo -e "${BRIGHT_GREEN}Gateway restarted.${RESET}"
    read -p "Press Enter to continue ..."
    detect_status
    show_menu
}

adv_update() {
    clear
    echo -e "${CYAN}Reviewing the official Hermes update plan...${RESET}"
    if ! run_observation diagnostics update-plan hermes update --plan; then
        log_event diagnostics update-plan failed
        echo ""
        echo -e "${BRIGHT_RED}[ERROR] Update plan failed. No update was applied.${RESET}"
        read -r -p "Press Enter to continue ..."
        show_advanced
        return
    fi
    log_event diagnostics update-plan succeeded

    echo ""
    read -r -p "Continue with the official Hermes update from origin/main? [y/N] " confirm_update
    case "$confirm_update" in
        y|Y|yes|YES)
            log_event diagnostics update-apply started
            if hermes update; then
                log_event diagnostics update-apply succeeded
                echo ""
                echo -e "${BRIGHT_GREEN}Hermes update completed. The displayed version will be refreshed.${RESET}"
                read -r -p "Press Enter to continue ..."
                detect_status
                show_menu
            else
                log_event diagnostics update-apply failed
                echo ""
                echo -e "${BRIGHT_RED}[ERROR] Hermes update failed. Review the updater output and portable logs.${RESET}"
                read -r -p "Press Enter to continue ..."
                show_advanced
            fi
            ;;
        *)
            log_event diagnostics update-apply cancelled
            echo "Update cancelled. No update was applied."
            read -r -p "Press Enter to continue ..."
            show_advanced
            ;;
    esac
}

adv_update_check() {
    clear
    log_event diagnostics update-check started
    if ! run_observation diagnostics update-check hermes update --check; then
        log_event diagnostics update-check failed
        echo ""
        echo -e "${BRIGHT_RED}[ERROR] Hermes update check failed. No update was applied.${RESET}"
    else
        log_event diagnostics update-check succeeded
    fi
    read -p "Press Enter to continue ..."
    show_advanced
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
detect_status
show_menu
