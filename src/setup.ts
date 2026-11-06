#!/usr/bin/env npx tsx
/**
 * Interactive setup: `notion-listen setup`. Safe to re-run any time to change
 * settings - current values are offered as defaults.
 *
 * 1. Notion integration token (checked against the API)
 * 2. Who may instruct the agent (NOTION_ALLOWED_AUTHORS)
 * 3. ngrok static domain (optional)
 * 4. zsh only: a noglob alias so pasted links with "?" work unquoted
 * 5. Webhook verification: opens the tunnel, waits for Notion's handshake, and
 *    prints the token to paste into Notion's Verify dialog.
 */
import { createInterface } from 'node:readline'
import { createServer } from 'node:http'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, openSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ENV_PATH, NOTION_VERSION, loadEnv, listenPort, persistEnv, norm, statePath } from './lib.ts'

const rl = createInterface({ input: process.stdin })
const lines = rl[Symbol.asyncIterator]()
async function ask(question: string, def = ''): Promise<string> {
  process.stdout.write(def ? `${question} [${def}]: ` : `${question}: `)
  const next = await lines.next()
  if (next.done) throw new Error('input closed')
  return next.value.trim() || def
}

// Secrets are read with terminal echo off, so they don't stay on screen.
async function askSecret(question: string, def = ''): Promise<string> {
  const tty = process.stdin.isTTY
  if (tty) spawnSync('stty', ['-echo'], { stdio: 'inherit' })
  try {
    return await ask(question, def)
  } finally {
    if (tty) { spawnSync('stty', ['echo'], { stdio: 'inherit' }); process.stdout.write('\n') }
  }
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const step = (n: number, title: string) => console.log(`\n${bold(`${n}. ${title}`)}`)
const mask = (s: string) => (s ? `${s.slice(0, 8)}…` : '')

async function notion(path: string, token: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<any>
}

async function listPeople(token: string): Promise<{ id: string; name: string }[]> {
  const people: { id: string; name: string }[] = []
  let cursor = ''
  do {
    const d = await notion(`/users?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, token)
    for (const u of d.results || []) if (u.type === 'person') people.push({ id: u.id, name: u.name || u.person?.email || u.id })
    cursor = d.has_more ? d.next_cursor : ''
  } while (cursor)
  return people
}

async function tunnelUrl(port: number): Promise<string> {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(2000) })
    const d: any = await res.json()
    const t = (d.tunnels || []).find((t: any) => t.public_url?.startsWith('https') && String(t.config?.addr || '').endsWith(`:${port}`))
    return t ? t.public_url : ''
  } catch {
    return ''
  }
}

const env = loadEnv()
const port = listenPort(env)
let ngrok: ChildProcess | null = null
const stopNgrok = () => { if (ngrok && !ngrok.killed) ngrok.kill() }
process.on('exit', stopNgrok)
let atWebhookStep = false
process.on('SIGINT', () => {
  if (process.stdin.isTTY) spawnSync('stty', ['echo'], { stdio: 'inherit' })
  if (atWebhookStep) {
    console.log('\nSkipped webhook verification. Run notion-listen setup again when you are ready.')
    finish()
  }
  console.log('\nsetup interrupted; settings entered so far are saved.')
  process.exit(130)
})

console.log(bold('notion-listen setup') + ` (settings: ${ENV_PATH})`)

// --- 1. token ---------------------------------------------------------------
step(1, 'Notion integration token')
console.log('Create an internal integration at https://www.notion.so/profile/integrations')
console.log('with these capabilities: Read content, Read comments, Insert comments, and')
console.log('Read user information. Then copy its "Internal Integration Secret".')
let token = env.NOTION_TOKEN || ''
let botName = ''
for (;;) {
  const answer = await askSecret('Token (input is hidden)', mask(token))
  if (answer !== mask(token)) token = answer
  if (!token) { console.log('A token is required.'); continue }
  try {
    const me = await notion('/users/me', token)
    botName = me.name || 'your integration'
    console.log(`ok - connected as "${botName}"`)
    break
  } catch (e: any) {
    console.log(`Notion rejected that token (${e.message}). Try again.`)
    token = ''
  }
}
persistEnv({ NOTION_TOKEN: token })

// --- 2. allowed authors -----------------------------------------------------
step(2, 'Who may instruct the agent')
console.log('Comments become instructions to an agent that can edit the page and your files.')
console.log('Pick the people whose comments it should act on (usually just you).')
let allowed = env.NOTION_ALLOWED_AUTHORS || ''
try {
  const people = await listPeople(token)
  if (people.length === 0) throw new Error('no people visible to the integration')
  people.forEach((p, i) => console.log(`  ${i + 1}) ${p.name}`))
  const current = new Set(allowed.split(',').map(s => norm(s.trim())).filter(Boolean))
  const def = people.map((p, i) => (current.has(norm(p.id)) ? String(i + 1) : '')).filter(Boolean).join(',')
  for (;;) {
    const answer = await ask('Your number (and teammates\', comma-separated), or "all" for anyone', def)
    if (!answer) { console.log('Pick at least one person, or type "all".'); continue }
    if (answer.toLowerCase() === 'all') { allowed = ''; break }
    const picks = answer.split(',').map(s => people[Number(s.trim()) - 1])
    if (picks.length && picks.every(Boolean)) { allowed = picks.map(p => p.id).join(','); break }
    console.log(`Enter numbers from 1 to ${people.length}, or "all".`)
  }
} catch (e: any) {
  console.log(`Could not list workspace users (${e.message}).`)
  console.log('Enable "Read user information" on the integration, or paste user ids by hand.')
  allowed = await ask('User ids, comma-separated (empty = anyone)', allowed)
}
persistEnv({ NOTION_ALLOWED_AUTHORS: allowed })
console.log(allowed ? `ok - ${allowed.split(',').length} allowed` : 'ok - anyone who can comment on the page')

// --- 3. ngrok ---------------------------------------------------------------
step(3, 'Public URL (ngrok)')
console.log('Notion needs a public URL to reach this machine; ngrok provides it.')
if (spawnSync('ngrok', ['version']).error) {
  console.log('ngrok is not installed. Install it from https://ngrok.com/download (or: brew install ngrok),')
  console.log('then run notion-listen setup again.')
  process.exit(1)
}
if (!ngrokSignedIn()) {
  console.log('ngrok needs your account\'s authtoken: https://dashboard.ngrok.com/get-started/your-authtoken')
  for (;;) {
    const authtoken = await askSecret('ngrok authtoken (input is hidden)')
    if (authtoken && spawnSync('ngrok', ['config', 'add-authtoken', authtoken]).status === 0) { console.log('ok - ngrok signed in'); break }
    console.log('That did not work; paste the authtoken from the link above.')
  }
}
console.log('Claim your free static domain at https://dashboard.ngrok.com/domains. Without it the')
console.log('URL changes on every run, and you would have to update the Notion webhook each time.')
const domain = (await ask('ngrok static domain, e.g. my-name.ngrok-free.app', env.NGROK_DOMAIN || '')).replace(/^https?:\/\//, '').replace(/\/.*$/, '')
if (!domain) console.log('ok - no static domain; remember to update the webhook URL in Notion after each restart.')
persistEnv({ NGROK_DOMAIN: domain })

// --- 4. shell ---------------------------------------------------------------
// zsh treats the ? in a pasted Notion link (...?source=copy_link) as a glob and
// fails with "no matches found" before notion-listen even runs. noglob fixes it.
let stepNo = 4
const zshrc = join(homedir(), '.zshrc')
const NOGLOB = "alias notion-listen='noglob notion-listen'"
if ((process.env.SHELL || '').endsWith('zsh') && !(existsSync(zshrc) && readFileSync(zshrc, 'utf8').includes(NOGLOB))) {
  step(stepNo++, 'Shell')
  console.log('zsh reads the "?" in pasted Notion links as a wildcard ("no matches found").')
  const add = await ask('Add an alias to ~/.zshrc so links work without quotes? (Y/n)')
  if (!/^n/i.test(add)) {
    appendFileSync(zshrc, `\n# notion-listen: let pasted Notion links (with ?) work unquoted\n${NOGLOB}\n`)
    console.log('ok - added. Open a new terminal (or run: source ~/.zshrc) to use it.')
  } else {
    console.log('ok - quote links instead: notion-listen "<page-url>"')
  }
}

// --- 5. webhook -------------------------------------------------------------
step(stepNo, 'Webhook')
if (env.NOTION_VERIFICATION_TOKEN) {
  const redo = await ask('Webhook already verified. Verify a new subscription? (y/N)')
  if (!/^y/i.test(redo)) finish()
}

let url = await tunnelUrl(port)
if (!url) {
  const logFd = openSync(statePath('ngrok.log'), 'w')
  ngrok = spawn('ngrok', ['http', String(port), ...(domain ? [ngrokDomainFlag(), domain] : []), '--log=stdout'], { stdio: ['ignore', logFd, logFd] })
  ngrok.on('error', () => {
    console.log('ngrok is not installed. Install it from https://ngrok.com/download, run')
    console.log('"ngrok config add-authtoken <token>", then re-run notion-listen setup.')
    process.exit(1)
  })
  for (let i = 0; i < 20 && !url; i++) { await new Promise(r => setTimeout(r, 500)); url = await tunnelUrl(port) }
  if (!url) {
    console.log(`ngrok did not come up; see ${statePath('ngrok.log')}.`)
    console.log('If it mentions an authtoken, run "ngrok config add-authtoken <token>" first.')
    process.exit(1)
  }
}
const hookUrl = `${url}/notion-webhook`

const server = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    let payload: any = {}
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {}
    res.writeHead(200).end('ok')
    if (!payload.verification_token) return
    persistEnv({ NOTION_VERIFICATION_TOKEN: payload.verification_token })
    console.log(`\nReceived. Paste this into Notion's "Verify" dialog:\n\n  ${bold(payload.verification_token)}\n`)
    console.log('(saved to config.env)')
    server.close()
    finish()
  })
})
server.on('error', (e: any) => {
  console.log(e.code === 'EADDRINUSE'
    ? `Port ${port} is busy - stop any running notion-listen session first (notion-listen stop).`
    : `Could not listen on port ${port}: ${e.message}`)
  process.exit(1)
})
// Accept the handshake even if a token is saved: the user asked to re-verify.
server.listen(port, '127.0.0.1', () => {
  atWebhookStep = true
  console.log(`In https://www.notion.so/profile/integrations open "${botName}" -> Webhooks -> Create subscription:`)
  console.log(`  URL:    ${bold(hookUrl)}`)
  console.log('  Events: Comment created')
  console.log('Waiting for Notion to send the verification token... (Ctrl+C to skip)')
})

// Signed in = an authtoken in ngrok's config file, or NGROK_AUTHTOKEN.
function ngrokSignedIn(): boolean {
  if (process.env.NGROK_AUTHTOKEN) return true
  const out = spawnSync('ngrok', ['config', 'check'], { encoding: 'utf8' }).stdout || ''
  const file = /Valid configuration file at (.+)/.exec(out)?.[1]?.trim()
  try { return !!file && /authtoken/.test(readFileSync(file, 'utf8')) } catch { return false }
}

// Newer ngrok calls it --url; older v3 agents only know --domain.
function ngrokDomainFlag(): string {
  const help = spawnSync('ngrok', ['http', '--help'], { encoding: 'utf8' })
  return /--url /.test(`${help.stdout}${help.stderr}`) ? '--url' : '--domain'
}

function finish(): never {
  stopNgrok()
  console.log(`\n${bold('Done.')} Settings are in ${ENV_PATH}; re-run notion-listen setup to change them.`)
  console.log('Next:')
  console.log(`  1. Open your Notion page -> ••• -> Connections -> add "${botName}"`)
  console.log('  2. cd into a project folder and run: notion-listen "<page-url>"')
  console.log('  3. First run only: in the Claude session, type /mcp and sign in to "notion"')
  console.log('     so the agent can edit pages.')
  process.exit(0)
}
