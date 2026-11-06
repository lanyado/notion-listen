// Folder-level MCP plumbing for bin/notion-listen.
//
//   write-config <folder> <server> <command> <script>
//     Merge the listener's server (and the hosted Notion server, if the project
//     has none) into <folder>/.mcp.json. Other servers are left untouched, a
//     stale entry from an older install path is corrected, and the other mode's
//     entry is removed: with both present, every session would also start the
//     other server, which then fights over the port or the router. The channel
//     flag only reads servers from the folder's .mcp.json, not --mcp-config.
//
//   enable <folder> <state-file> <server>...
//   restore <folder> <state-file>
//     Claude Code remembers switched-off servers per folder in two places, and
//     either one makes the channel silently not start (the session still shows
//     the channels banner, but no comments ever arrive):
//       - <folder>/.claude/settings.local.json  disabledMcpjsonServers
//         (declining the "new MCP server found" prompt)
//       - ~/.claude.json  projects[<folder>].disabledMcpServers  (/mcp -> disable)
//     enable switches the given servers back on and records what it changed;
//     restore puts that choice back when the session ends.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const NOTION_MCP = { type: 'http', url: 'https://mcp.notion.com/mcp' }
// notion-channel-multi is the listener's old name (from the removed --multi
// mode); writing the current entry drops it.
const LISTENERS = ['notion-channel', 'notion-channel-multi']

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

// Write via rename so a concurrent reader never sees a half-written file.
function writeJson(path, data) {
  const tmp = `${path}.notion-listen-${process.pid}`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, path)
}

function writeConfig(folder, server, command, script) {
  const path = join(folder, '.mcp.json')
  let data = { mcpServers: {} }
  if (existsSync(path)) {
    data = readJson(path)
    if (!data || typeof data !== 'object') {
      console.error(`${path} is not valid JSON; fix or delete it, then run notion-listen again.`)
      process.exit(1)
    }
  }
  data.mcpServers ??= {}
  const want = { command, args: [script] }
  const before = JSON.stringify(data.mcpServers)
  data.mcpServers[server] = want
  delete data.mcpServers[LISTENERS.find(s => s !== server)]
  data.mcpServers.notion ??= NOTION_MCP
  if (JSON.stringify(data.mcpServers) === before) return
  writeJson(path, data)
  console.log(`updated .mcp.json in this folder (${server}${before.includes('"notion"') ? '' : ', notion'})`)
}

// Each target: where the list lives, and how to reach it inside the file.
function targets(folder) {
  return [
    { key: 'local', path: join(folder, '.claude', 'settings.local.json'), list: d => d, field: 'disabledMcpjsonServers' },
    { key: 'global', path: join(homedir(), '.claude.json'), list: d => d.projects?.[folder], field: 'disabledMcpServers' },
  ]
}

function enable(folder, stateFile, servers) {
  const removed = {}
  for (const t of targets(folder)) {
    const data = existsSync(t.path) ? readJson(t.path) : null
    const holder = data && t.list(data)
    const list = holder?.[t.field]
    if (!Array.isArray(list)) continue
    const hit = list.filter(s => servers.includes(s))
    if (hit.length === 0) continue
    holder[t.field] = list.filter(s => !servers.includes(s))
    writeJson(t.path, data)
    removed[t.key] = hit
    console.log(`switched back on for this folder: ${hit.join(', ')} (restored when the session ends)`)
  }
  writeFileSync(stateFile, JSON.stringify(removed))
}

function restore(folder, stateFile) {
  const removed = readJson(stateFile) || {}
  rmSync(stateFile, { force: true })
  for (const t of targets(folder)) {
    const names = removed[t.key]
    if (!names?.length) continue
    const data = readJson(t.path)
    const holder = data && t.list(data)
    if (!holder) continue
    const list = Array.isArray(holder[t.field]) ? holder[t.field] : []
    holder[t.field] = [...list, ...names.filter(s => !list.includes(s))]
    writeJson(t.path, data)
  }
}

const [cmd, folder, ...rest] = process.argv.slice(2)
if (cmd === 'write-config' && rest.length === 3) writeConfig(folder, ...rest)
else if (cmd === 'enable' && rest.length >= 2) enable(folder, rest[0], rest.slice(1))
else if (cmd === 'restore' && rest.length === 1) restore(folder, rest[0])
else {
  console.error('usage: mcp-servers.mjs write-config <folder> <server> <command> <script>\n' +
    '       mcp-servers.mjs enable <folder> <state-file> <server>...\n' +
    '       mcp-servers.mjs restore <folder> <state-file>')
  process.exit(2)
}
