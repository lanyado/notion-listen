#!/usr/bin/env npx tsx
/**
 * Notion webhook router: one per machine, shared by every session.
 *
 * Owns the webhook port and receives ALL Notion webhooks. Each session's
 * channel server (channel.ts) keeps a connection open to the control socket
 * and registers its page; the router forwards each event down the connection
 * of the session bound to that page. A closed connection means the session is
 * gone, however it ended, so the registry never goes stale.
 *
 * Started (detached) by `notion-listen <url>`. When no session has been
 * connected for IDLE_MS, it stops the shared ngrok tunnel and exits;
 * `notion-listen stop` stops both at once.
 */
import { createServer as createHttpServer } from 'node:http'
import { createServer as createUnixServer, Socket } from 'node:net'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { loadEnv, statePath, listenPort, persistVerificationToken, norm, makeLogger } from './lib.ts'

const CONTROL_SOCK = statePath('router.sock')
const log = makeLogger(statePath('router.log'), 'router')
// Long enough to restart a session without tearing the tunnel down.
const IDLE_MS = Number(process.env.NOTION_LISTEN_IDLE_SECONDS || 60) * 1000

const env = loadEnv()
const PORT = listenPort(env)

// --- session registry -------------------------------------------------------
// page id (normalized) -> connections of the sessions bound to it, newest last.
// Two sessions on one page: the newer one gets the events, and the older one
// takes over again if the newer one closes.
const sessions = new Map<string, Socket[]>()
const connections = new Set<Socket>()

function register(socket: Socket, pageId: string) {
  const pid = norm(pageId)
  sessions.set(pid, [...(sessions.get(pid) || []), socket])
  log(`registered page ${pageId} (${sessions.size} active)`)
}

function deregister(socket: Socket, pid: string) {
  const left = (sessions.get(pid) || []).filter(s => s !== socket)
  if (left.length) sessions.set(pid, left)
  else sessions.delete(pid)
  log(`deregistered page ${pid} (${sessions.size} active)`)
}

function forwardEvent(pageId: string, commentId: string, blockId: string, authorIds: string[]) {
  const socket = sessions.get(norm(pageId))?.at(-1)
  if (!socket) {
    log(`no session for page ${pageId} (dropped comment ${commentId})`)
    return
  }
  socket.write(JSON.stringify({
    type: 'comment_event',
    page_id: pageId,
    comment_id: commentId,
    block_id: blockId,
    authors: authorIds,
  }) + '\n')
  log(`forwarded ${commentId} to page ${pageId}`)
}

// --- idle shutdown ------------------------------------------------------------
let idleTimer: NodeJS.Timeout | undefined
function armIdle() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    log(`no sessions for ${IDLE_MS / 1000}s; stopping ngrok and the router`)
    // ngrok alone would answer Notion's webhooks with errors, and enough of
    // those make Notion pause the subscription. Same match as the CLI's.
    spawnSync('pkill', ['-f', `^([^ ]*/)?ngrok http ${PORT}( |$)`])
    cleanup()
  }, IDLE_MS)
}

function signatureOk(rawBody: string, header: string | null): boolean {
  const token = env.NOTION_VERIFICATION_TOKEN
  if (!token || !header) return false
  const expected = `sha256=${createHmac('sha256', token).update(rawBody).digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

// --- HTTP listener (Notion webhooks) ----------------------------------------
createHttpServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
    if (req.method !== 'POST' || url.pathname !== '/notion-webhook') {
      res.writeHead(404).end('not found'); return
    }

    const rawBody = Buffer.concat(chunks).toString('utf8')
    let payload: any
    try { payload = JSON.parse(rawBody) } catch { res.writeHead(400).end('bad json'); return }

    // Verification handshake: Notion sends the token once when the webhook
    // subscription is created. Persist it for signature checks. Accept it only
    // while none is saved: the handshake is unsigned, so otherwise anyone who
    // knows the tunnel URL could swap in their own token and sign forged events.
    if (payload.verification_token) {
      if (env.NOTION_VERIFICATION_TOKEN) {
        log('rejected verification_token: one is already saved (run notion-listen setup to verify a new subscription)')
        res.writeHead(401).end('already verified')
        return
      }
      env.NOTION_VERIFICATION_TOKEN = payload.verification_token
      persistVerificationToken(payload.verification_token)
      // Never print the secret itself: this output can end up in a log file.
      log('received the webhook verification token and saved it to config.env (NOTION_VERIFICATION_TOKEN); paste it into Notion\'s Verify dialog, or run notion-listen setup')
      res.writeHead(200).end('ok')
      return
    }

    if (!signatureOk(rawBody, req.headers['x-notion-signature'] as string)) {
      log('dropped: bad/missing signature')
      res.writeHead(401).end('bad signature')
      return
    }

    // Only new comments are tasks. Notion also sends comment.updated when the
    // highlighted text under an old comment changes, for example after an
    // agent rewrites the paragraph; acting on it would redo finished work.
    if (payload.type !== 'comment.created') {
      if (payload.type) log(`ignored ${payload.type}`)
      res.writeHead(200).end('ignored'); return
    }

    const pageId = payload.data?.page_id || payload.data?.parent?.id
    const commentId = payload.entity?.id
    const blockId = payload.data?.parent?.id || pageId
    const authorIds: string[] = (payload.authors || []).map((a: any) => String(a.id || ''))

    // Ack immediately so Notion never sees an error: unanswered webhooks
    // accumulate and cause Notion to auto-pause the subscription.
    res.writeHead(200).end('ok')

    if (!pageId || !commentId) {
      log('malformed event: missing page_id or comment_id')
      return
    }

    forwardEvent(String(pageId), String(commentId), String(blockId || ''), authorIds)
  })
}).listen(PORT, '127.0.0.1', () => log(`HTTP listener on 127.0.0.1:${PORT}`))

// --- control socket (sessions) ----------------------------------------------
// Any connection keeps the router up, registered or not: the CLI holds one
// while Claude Code starts, before the session's channel server connects.
if (existsSync(CONTROL_SOCK)) unlinkSync(CONTROL_SOCK)
createUnixServer((socket) => {
  connections.add(socket)
  clearTimeout(idleTimer)
  let page = ''
  let buf = ''
  socket.on('data', chunk => {
    buf += chunk.toString('utf8')
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        if (msg.type === 'register' && msg.page_id && !page) {
          page = norm(msg.page_id)
          register(socket, msg.page_id)
        } else {
          log(`unknown control message: ${line.slice(0, 120)}`)
        }
      } catch (e: any) {
        log(`bad control message: ${e.message}`)
      }
    }
  })
  socket.on('close', () => {
    connections.delete(socket)
    if (page) deregister(socket, page)
    if (connections.size === 0) armIdle()
  })
  socket.on('error', e => log(`control socket error: ${e.message}`))
}).listen(CONTROL_SOCK, () => log(`control socket at ${CONTROL_SOCK}`))

armIdle()
log('router started')

// Clean up the socket file on exit so the next start doesn't hit EADDRINUSE.
function cleanup() { try { unlinkSync(CONTROL_SOCK) } catch {} process.exit(0) }
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
