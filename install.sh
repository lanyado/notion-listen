#!/usr/bin/env bash
# notion-listen installer.
#
#   curl -fsSL https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh | bash
#
# Installs into ~/.notion-listen, links the `notion-listen` command into
# ~/.local/bin, and starts the setup wizard. Safe to re-run: it updates an
# existing install. Settings in ~/.config/notion-listen are never touched.
#
# Environment overrides:
#   NOTION_LISTEN_HOME   install folder         (default ~/.notion-listen)
#   NOTION_LISTEN_BIN    folder for the command (default ~/.local/bin)
#   NOTION_LISTEN_REPO   git URL to install from
#   NOTION_LISTEN_REF    branch to follow       (default main; notion-listen update follows it)
#   NOTION_LISTEN_NO_SETUP=1  skip the setup wizard
set -euo pipefail

HOME_DIR="${NOTION_LISTEN_HOME:-$HOME/.notion-listen}"
BIN_DIR="${NOTION_LISTEN_BIN:-$HOME/.local/bin}"
REPO="${NOTION_LISTEN_REPO:-https://github.com/lanyado/notion-listen.git}"
REF="${NOTION_LISTEN_REF:-main}"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  B=$'\033[1m' R=$'\033[31m' G=$'\033[32m' Y=$'\033[33m' X=$'\033[0m'
else
  B="" R="" G="" Y="" X=""
fi
step() { echo "${B}==>${X} $*"; }
ok()   { echo "  ${G}✔${X} $*"; }
warn() { echo "  ${Y}!${X} $*"; }
die()  { echo "  ${R}✖${X} $*" >&2; exit 1; }

echo "${B}notion-listen installer${X}"
echo

step "Checking requirements"
case "$(uname -s)" in
  Darwin|Linux) ok "$(uname -s)" ;;
  *) die "notion-listen supports macOS and Linux (on Windows, use WSL)" ;;
esac
command -v git >/dev/null || die "git is required: https://git-scm.com/downloads"
ok "git"
command -v node >/dev/null || die "Node.js 20+ is required: https://nodejs.org (or: brew install node)"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || die "Node.js $(node -v) is too old; version 20 or newer is required"
ok "Node.js $(node -v)"
command -v npm >/dev/null || die "npm is required (it comes with Node.js)"
missing=0
if command -v claude >/dev/null; then ok "Claude Code"
else warn "Claude Code is not installed yet: https://docs.claude.com/en/docs/claude-code"; missing=1; fi
if command -v ngrok >/dev/null; then ok "ngrok"
else warn "ngrok is not installed yet: https://ngrok.com/download (or: brew install ngrok)"; missing=1; fi
command -v curl >/dev/null || die "curl is required"
command -v lsof >/dev/null || die "lsof is required (Debian/Ubuntu: sudo apt install lsof; Fedora: sudo dnf install lsof)"

step "Installing into $HOME_DIR"
if [ -d "$HOME_DIR/.git" ]; then
  git -C "$HOME_DIR" fetch --quiet --depth 1 origin "$REF"
  git -C "$HOME_DIR" checkout --quiet -B "$REF" FETCH_HEAD
  ok "updated to the latest $REF"
elif [ -e "$HOME_DIR" ]; then
  die "$HOME_DIR exists but isn't a notion-listen install. Move it away, or set NOTION_LISTEN_HOME."
else
  git clone --quiet --depth 1 --branch "$REF" "$REPO" "$HOME_DIR"
  ok "downloaded"
fi
(cd "$HOME_DIR" && npm ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error >/dev/null)
ok "dependencies installed"

step "Adding the notion-listen command"
mkdir -p "$BIN_DIR"
ln -sf "$HOME_DIR/bin/notion-listen" "$BIN_DIR/notion-listen"
ok "$BIN_DIR/notion-listen"

# Put BIN_DIR on PATH for future shells, once, with a marker so re-runs and
# uninstalls can find the line.
case ":$PATH:" in
  *":$BIN_DIR:"*) on_path=1 ;;
  *) on_path=0 ;;
esac
if [ "$on_path" = 0 ]; then
  case "$(basename "${SHELL:-}")" in
    zsh) rc="$HOME/.zshrc" ;;
    bash)
      # macOS bash runs login shells: it reads the first of .bash_profile and
      # .profile that exists, so don't create a .bash_profile that would hide
      # an existing .profile.
      if [ "$(uname -s)" != Darwin ]; then rc="$HOME/.bashrc"
      elif [ -f "$HOME/.bash_profile" ] || [ ! -f "$HOME/.profile" ]; then rc="$HOME/.bash_profile"
      else rc="$HOME/.profile"; fi ;;
    *) rc="" ;;
  esac
  if [ -n "$rc" ]; then
    if ! grep -qs "# added by notion-listen" "$rc"; then
      # Write $HOME rather than the expanded path when BIN_DIR is under it.
      shown="${BIN_DIR/#$HOME/\$HOME}"
      # shellcheck disable=SC2016 # $PATH must stay literal in the rc file
      printf '\nexport PATH="%s:$PATH" # added by notion-listen\n' "$shown" >> "$rc"
    fi
    ok "added $BIN_DIR to PATH in $rc (open a new terminal to pick it up)"
  else
    warn "add $BIN_DIR to your PATH to use the notion-listen command"
  fi
fi
export PATH="$BIN_DIR:$PATH"

echo
echo "${G}${B}Installed notion-listen $("$BIN_DIR/notion-listen" --version | awk '{print $2}').${X}"
if [ "$missing" = 1 ]; then
  echo "Install the missing tools above, then run: ${B}notion-listen setup${X}"
elif [ "${NOTION_LISTEN_NO_SETUP:-}" = 1 ]; then
  echo "Next: ${B}notion-listen setup${X}"
elif [ -r /dev/tty ] && (exec </dev/tty) 2>/dev/null; then
  # Piped into bash (curl | bash), stdin is the script itself; the wizard
  # needs the keyboard.
  echo
  "$BIN_DIR/notion-listen" setup </dev/tty
else
  echo "Next: ${B}notion-listen setup${X}"
fi
