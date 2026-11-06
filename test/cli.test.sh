#!/usr/bin/env bash
# Run: bash test/cli.test.sh
# Tests the CLI and its helpers against a throwaway copy of the install, a fake
# HOME and stub claude/ngrok commands. No network, no real settings touched.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

pass=0 fail=0
check() { # check <name> <expected-substring> <actual>
  if [[ "$3" == *"$2"* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL [$1] want: $2"; echo "     got: $3"; fi
}

# A copy of the install, so the CLI's ROOT (and anything it might move) is ours.
mkdir -p "$T/install" "$T/home" "$T/stubs" "$T/project"
cp -R "$REPO/bin" "$REPO/src" "$REPO/config" "$REPO/prompts" "$REPO/package.json" "$T/install/"
ln -s "$REPO/node_modules" "$T/install/node_modules"
for tool in claude ngrok; do printf '#!/bin/sh\necho "%s stub"\n' "$tool" > "$T/stubs/$tool"; chmod +x "$T/stubs/$tool"; done
export HOME="$T/home" PATH="$T/stubs:$PATH" NO_COLOR=1 SHELL=/bin/bash
export NOTION_LISTEN_CONFIG_DIR="$T/home/config" NOTION_LISTEN_STATE_DIR="$T/home/state"
unset NOTION_TOKEN NOTION_VERIFICATION_TOKEN NOTION_ALLOWED_AUTHORS NGROK_DOMAIN NOTION_LISTEN_PORT
CLI="$T/install/bin/notion-listen"
ID=7c1e9a5b3f2d4e8a9b0c1d2e3f4a5b6c

# --- commands ---------------------------------------------------------------
check "version" "notion-listen $(node -p "require('$REPO/package.json').version")" "$("$CLI" --version)"
check "help" "Usage" "$("$CLI" help)"
out="$(cd "$T/project" && "$CLI" "not a link" 2>&1)"; code=$?
check "bad link message" "couldn't find a Notion page id" "$out"
check "bad link exit code" "1" "$code"
out="$(cd "$T/project" && "$CLI" "https://app.notion.com/p/team/Page-$ID?source=copy_link" 2>&1)"; code=$?
check "not set up yet" "not set up yet" "$out"
check "not set up exit code" "1" "$code"
out="$("$CLI" doctor 2>&1)"; code=$?
check "doctor finds the missing token" "no Notion token" "$out"
check "doctor exit code" "1" "$code"

# Old installs kept settings in <install>/.env; the CLI moves them once.
printf 'NOTION_TOKEN=secret_x\n' > "$T/install/.env"
"$CLI" --version >/dev/null
check "migrates legacy .env" "NOTION_TOKEN=secret_x" "$(cat "$NOTION_LISTEN_CONFIG_DIR/config.env" 2>&1)"
check "legacy .env removed" "gone" "$([ -e "$T/install/.env" ] && echo present || echo gone)"
check "config is private" "-rw-------" "$(ls -l "$NOTION_LISTEN_CONFIG_DIR/config.env" | cut -c1-10)"

# --- page id parsing (the function itself, from the CLI source) -------------
sed -n '/^parse_page_id()/,/^}/p' "$CLI" > "$T/parse.sh"
source "$T/parse.sh"
for link in \
  "https://app.notion.com/p/lanyado/Interview-$ID?source=copy_link" \
  "https://www.notion.so/My-Page-$ID?pvs=4" \
  "https://www.notion.so/workspace/Code-$ID" \
  "https://www.notion.so/$ID" \
  "https://www.notion.so/My-Page-$ID/" \
  "$ID" \
  "7c1e9a5b-3f2d-4e8a-9b0c-1d2e3f4a5b6c" \
  "https://www.notion.so/ws/Tasks-1111111111111111aaaaaaaaaaaaaaaa?v=2222222222222222bbbbbbbbbbbbbbbb&p=$ID&pm=s"; do
  check "parse $link" "$ID" "$(parse_page_id "$link")"
done
[ -z "$(parse_page_id "https://www.notion.so/Short-abc")" ] && pass=$((pass + 1)) || { fail=$((fail + 1)); echo "FAIL [parse rejects short id]"; }

# --- .mcp.json merging ------------------------------------------------------
M="$T/install/src/mcp-servers.mjs"
P="$T/project"
echo '{"mcpServers":{"mine":{"command":"x"},"notion-channel":{"command":"old","args":["/old/notion-channel.ts"]}}}' > "$P/.mcp.json"
node "$M" write-config "$P" notion-channel /i/tsx /i/src/channel.ts >/dev/null
cfg="$(node -e 'const c=require(process.argv[1]).mcpServers;console.log(JSON.stringify([c.mine,c["notion-channel"],c.notion.url]))' "$P/.mcp.json")"
check "keeps other servers" '{"command":"x"}' "$cfg"
check "fixes a stale entry" '{"command":"/i/tsx","args":["/i/src/channel.ts"]}' "$cfg"
check "adds hosted notion" 'https://mcp.notion.com/mcp' "$cfg"
check "second write is a no-op" "" "$(node "$M" write-config "$P" notion-channel /i/tsx /i/src/channel.ts)"
node -e 'const f=process.argv[1],c=require(f);c.mcpServers["notion-channel-multi"]={command:"old"};require("fs").writeFileSync(f,JSON.stringify(c))' "$P/.mcp.json"
node "$M" write-config "$P" notion-channel /i/tsx /i/src/channel.ts >/dev/null
check "drops the old --multi entry" '["mine","notion","notion-channel"]' "$(node -e 'console.log(JSON.stringify(Object.keys(require(process.argv[1]).mcpServers).sort()))' "$P/.mcp.json")"
echo '{ not json' > "$P/.mcp.json"
out="$(node "$M" write-config "$P" notion-channel /i/tsx /i/src/channel.ts 2>&1)"; code=$?
check "refuses invalid .mcp.json" "not valid JSON" "$out"
check "invalid .mcp.json exit code" "1" "$code"
check "invalid .mcp.json left alone" "{ not json" "$(cat "$P/.mcp.json")"

# --- switched-off servers: enable, then restore -----------------------------
mkdir -p "$P/.claude"
echo '{"permissions":{"allow":["X"]},"disabledMcpjsonServers":["notion-channel","other"]}' > "$P/.claude/settings.local.json"
echo "{\"projects\":{\"$P\":{\"disabledMcpServers\":[\"gmail\",\"notion\"]},\"/elsewhere\":{\"disabledMcpServers\":[\"notion\"]}}}" > "$HOME/.claude.json"
local_list() { node -e 'console.log(JSON.stringify(require(process.argv[1]).disabledMcpjsonServers))' "$P/.claude/settings.local.json"; }
global_list() { node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify([c.projects[process.argv[2]].disabledMcpServers,c.projects["/elsewhere"].disabledMcpServers]))' "$HOME/.claude.json" "$P"; }
node "$M" enable "$P" "$T/state.json" notion-channel notion >/dev/null
check "enable: local" '["other"]' "$(local_list)"
check "enable: global, other folders untouched" '[["gmail"],["notion"]]' "$(global_list)"
node "$M" restore "$P" "$T/state.json"
check "restore: local" '["other","notion-channel"]' "$(local_list)"
check "restore: global" '[["gmail","notion"],["notion"]]' "$(global_list)"
check "restore: other settings kept" '["X"]' "$(node -e 'console.log(JSON.stringify(require(process.argv[1]).permissions.allow))' "$P/.claude/settings.local.json")"
check "restore: state file removed" "gone" "$([ -e "$T/state.json" ] && echo present || echo gone)"

# --- user overrides in the config folder ----------------------------------
sed -n '/^user_or_bundled()/,/^}/p' "$CLI" > "$T/override.sh"
ROOT="$T/install" CONFIG_DIR="$NOTION_LISTEN_CONFIG_DIR" bash -c "source '$T/override.sh'; user_or_bundled prompts/worker.md" > "$T/o1"
check "bundled prompt by default" "$T/install/prompts/worker.md" "$(cat "$T/o1")"
cp "$REPO/prompts/worker.md" "$NOTION_LISTEN_CONFIG_DIR/worker.md"
ROOT="$T/install" CONFIG_DIR="$NOTION_LISTEN_CONFIG_DIR" bash -c "source '$T/override.sh'; user_or_bundled prompts/worker.md" > "$T/o2"
check "own copy overrides the bundled prompt" "$NOTION_LISTEN_CONFIG_DIR/worker.md" "$(cat "$T/o2")"
check "lib.ts resolves the same file" "$NOTION_LISTEN_CONFIG_DIR/worker.md" "$(cd "$T/install" && node_modules/.bin/tsx -e "import('./src/lib.ts').then(m => console.log(m.userOrBundled('prompts/worker.md')))")"

echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
