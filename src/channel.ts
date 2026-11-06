#!/usr/bin/env npx tsx
/**
 * Notion comment channel for Claude Code.
 *
 * Session-bound MCP server (stdio, spawned by Claude Code). Connects to the
 * webhook router (router.ts), registers its page, and pushes the comments the
 * router forwards into the Claude session; the session replies through the
 * reply_to_comment tool. Any number can run at once, one page each.
 */
import { createConnection } from 'node:net'
import { loadEnv, statePath, norm, makeLogger, createChannelServer } from './lib.ts'

const CONTROL_SOCK = statePath('router.sock')

const env = loadEnv()
const PAGE_ID = env.NOTION_PAGE_ID
if (!PAGE_ID) {
  process.stderr.write('[notion-channel] ERROR: NOTION_PAGE_ID not set\n')
  process.exit(1)
}
const PAGE_ID_NORM = norm(PAGE_ID)

const baseLog = makeLogger(statePath('channel.log'), 'notion-channel')
const log = (msg: string) => baseLog(`[${PAGE_ID.slice(-8)}] ${msg}`)

const channel = await createChannelServer({ name: 'notion-channel', env, log })
await channel.connect()
log(`connected for page ${PAGE_ID}`)
if (!env.NOTION_TOKEN) log('WARNING: NOTION_TOKEN not set; cannot fetch comment text or reply.')

let BOT_ID_NORM = ''
if (env.NOTION_TOKEN) {
  channel.fetchSelfId()
    .then(id => { BOT_ID_NORM = id; log(`self id ${id} (will ignore own comments)`) })
    .catch(e => log(`could not fetch self id: ${e.message}`))
}

function handleEvent(msg: any) {
  if (msg.type !== 'comment_event') { log(`unknown event: ${JSON.stringify(msg).slice(0, 120)}`); return }
  if (norm(msg.page_id) !== PAGE_ID_NORM) {
    log(`WARN: got event for page ${msg.page_id} but bound to ${PAGE_ID} (ignored)`)
    return
  }
  // Drop our own replies, otherwise the session reacts to its own posts.
  const authorIds: string[] = (msg.authors || []).map((id: string) => norm(id))
  if (BOT_ID_NORM && authorIds.includes(BOT_ID_NORM)) {
    log(`dropped self-authored ${msg.comment_id}`)
    return
  }
  channel.enqueue({
    commentId: String(msg.comment_id || ''),
    blockId: String(msg.block_id || ''),
    pageId: String(msg.page_id || ''),
  })
}

// Stay connected to the router for the whole session: the open connection is
// how the router knows this session is alive. If the router goes away (e.g.
// `notion-listen stop`), keep retrying, so starting notion-listen in any
// terminal brings this session back too.
let reported = false
function connectToRouter() {
  const socket = createConnection(CONTROL_SOCK)
  let buf = ''
  let registered = false
  socket.on('connect', () => {
    socket.write(JSON.stringify({ type: 'register', page_id: PAGE_ID }) + '\n')
    registered = true
    reported = false
    log('registered with the router')
  })
  socket.on('data', chunk => {
    buf += chunk.toString('utf8')
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try { handleEvent(JSON.parse(line)) } catch (e: any) { log(`bad event message: ${e.message}`) }
    }
  })
  socket.on('error', e => {
    if (!reported) log(`cannot reach the router (${e.message}); retrying until it is back`)
    reported = true
  })
  socket.on('close', () => {
    if (registered) log('lost the router connection; reconnecting')
    setTimeout(connectToRouter, 2000)
  })
}
connectToRouter()

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
process.on('SIGHUP', () => process.exit(0)) // terminal window closed
