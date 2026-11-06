// Run: npx tsx test/router.test.ts
// Runs the real webhook router against a temporary config and state folder on
// a free port, with fake sessions on its control socket. No network.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createConnection, createServer, type Socket } from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
function check(note: string, ok: boolean, detail = '') {
  if (ok) pass++
  else { fail++; console.error(`FAIL [${note}] ${detail}`) }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function until(cond: () => boolean, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (cond()) return true
  return cond()
}

// Short paths: macOS caps unix socket paths at 104 characters.
const T = mkdtempSync('/tmp/nl-router-')
const STATE = join(T, 's'), CONFIG = join(T, 'c')
mkdirSync(STATE); mkdirSync(CONFIG)
const SECRET = 'test-verification-token'
writeFileSync(join(CONFIG, 'config.env'), `NOTION_VERIFICATION_TOKEN=${SECRET}\n`)
const SOCK = join(STATE, 'router.sock')

const port: number = await new Promise(resolve => {
  const s = createServer().listen(0, '127.0.0.1', () => {
    const p = (s.address() as { port: number }).port
    s.close(() => resolve(p))
  })
})

let router: ChildProcess | undefined
let routerExited = false
function startRouter() {
  routerExited = false
  router = spawn(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'src/router.ts')], {
    env: { ...process.env, NOTION_LISTEN_STATE_DIR: STATE, NOTION_LISTEN_CONFIG_DIR: CONFIG, NOTION_LISTEN_PORT: String(port), NOTION_LISTEN_IDLE_SECONDS: '1' },
    stdio: 'ignore',
  })
  router.on('exit', () => { routerExited = true })
}

type Session = { socket: Socket; events: any[]; closed: boolean }
async function session(pageId: string | null): Promise<Session> {
  const s: Session = { socket: createConnection(SOCK), events: [], closed: false }
  let buf = ''
  s.socket.on('data', c => {
    buf += c.toString()
    const lines = buf.split('\n'); buf = lines.pop() || ''
    for (const l of lines) if (l.trim()) s.events.push(JSON.parse(l))
  })
  s.socket.on('close', () => { s.closed = true })
  await new Promise<void>((resolve, reject) => { s.socket.once('connect', resolve); s.socket.once('error', reject) })
  if (pageId) s.socket.write(JSON.stringify({ type: 'register', page_id: pageId }) + '\n')
  await sleep(150)
  return s
}
async function close(s: Session) { s.socket.end(); await until(() => s.closed) }

async function comment(pageId: string, commentId: string, sign = true, type = 'comment.created') {
  const body = JSON.stringify({ type, entity: { id: commentId }, data: { page_id: pageId, parent: { id: pageId } }, authors: [{ id: 'u1' }] })
  const sig = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
  const res = await fetch(`http://127.0.0.1:${port}/notion-webhook`, {
    method: 'POST', body, headers: { 'content-type': 'application/json', ...(sign ? { 'x-notion-signature': sig } : {}) },
  })
  await sleep(150)
  return res.status
}

const A = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d'
const B = 'ffffffffffffffffffffffffffffffff'

try {
  startRouter()
  check('router starts', await until(() => existsSync(SOCK)))

  // Routing by page, with dashes or without.
  const a = await session(A)
  const b = await session('ffffffff-ffff-ffff-ffff-ffffffffffff')
  check('signed event accepted', (await comment(A, 'c1')) === 200)
  check('event reaches its page', a.events.length === 1 && a.events[0].comment_id === 'c1', JSON.stringify(a.events))
  check('event skips other pages', b.events.length === 0)
  await comment(B, 'c2')
  check('dashed page id matches', b.events.length === 1 && b.events[0].comment_id === 'c2', JSON.stringify(b.events))
  check('unsigned event rejected', (await comment(A, 'c3', false)) === 401)
  check('unsigned event not forwarded', a.events.length === 1)
  // Rewriting highlighted text makes Notion send comment.updated for old comments.
  check('comment.updated acknowledged', (await comment(A, 'c3u', true, 'comment.updated')) === 200)
  check('comment.updated not forwarded', a.events.length === 1, JSON.stringify(a.events))

  // Two sessions on one page: the newer one gets events, the older takes over when it closes.
  const a2 = await session(A)
  await comment(A, 'c4')
  check('newest session on a page gets the event', a2.events.length === 1 && a.events.length === 1)
  await close(a2)
  await comment(A, 'c5')
  check('older session takes over', a.events.length === 2 && a.events[1].comment_id === 'c5')

  // Stays up while anything is connected, even past the idle time.
  await close(b)
  await sleep(1600)
  check('stays up while a session is connected', !routerExited)

  // A connection that never registers (the CLI's hold) also keeps it up.
  const hold = await session(null)
  await close(a)
  await sleep(1600)
  check('stays up while the launcher holds it', !routerExited)

  // Last connection gone: after the idle time it stops ngrok and exits.
  const fakeNgrok = spawnSync('perl', ['-v']).status === 0
    ? spawn('perl', ['-e', `$0 = "ngrok http ${port} --log=stdout"; sleep 30`], { stdio: 'ignore' })
    : undefined
  let ngrokExited = false
  fakeNgrok?.on('exit', () => { ngrokExited = true })
  await sleep(200)
  await close(hold)
  check('exits once no session is left', await until(() => routerExited, 4000))
  check('removes its socket', !existsSync(SOCK))
  if (fakeNgrok) check('stops ngrok on its port', await until(() => ngrokExited, 2000))
  else console.log('(perl not found: skipped the ngrok check)')
  fakeNgrok?.kill()

  // Starts again cleanly after an idle exit.
  startRouter()
  check('restarts', await until(() => existsSync(SOCK)))
  const c = await session(A)
  await comment(A, 'c6')
  check('works after a restart', c.events.length === 1)
  await close(c)
} finally {
  router?.kill()
  rmSync(T, { recursive: true, force: true })
}

console.log(`router: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
