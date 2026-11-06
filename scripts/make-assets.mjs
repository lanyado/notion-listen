// Generates the README banner and animated demo (light + dark) into <out>/assets.
// Usage: node scripts/make-assets.mjs .   (from the repo root; rewrites assets/*.svg)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.argv[2], 'assets')
mkdirSync(out, { recursive: true })

const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif`
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const themes = {
  light: {
    text: '#111827', muted: '#6B7280', faint: '#D1D5DB', page: '#FFFFFF', border: '#E5E7EB',
    card: '#F9FAFB', highlight: '#FDE68A', chrome: '#F3F4F6',
  },
  dark: {
    text: '#F3F4F6', muted: '#9CA3AF', faint: '#3F3F46', page: '#18181B', border: '#2E2E33',
    card: '#232327', highlight: 'rgba(250, 204, 21, 0.32)', chrome: '#1F1F23',
  },
}
const ACCENT_A = '#6366F1', ACCENT_B = '#A855F7'
const TERM = { bg: '#0D1117', border: '#30363D', text: '#E6EDF3', dim: '#8B949E', green: '#3FB950', accent: '#C4B5FD', yellow: '#E3B341' }

// The logo: a comment bubble with a spark, on a gradient tile.
function logo(x, y, size) {
  const s = size / 96
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect width="96" height="96" rx="24" fill="url(#grad)"/>
    <path d="M24 30a10 10 0 0 1 10-10h28a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H44l-12 11v-11h0a10 10 0 0 1-8-10z" fill="#FFFFFF"/>
    <path d="M48 28l3.2 7.8L59 39l-7.8 3.2L48 50l-3.2-7.8L37 39l7.8-3.2z" fill="${ACCENT_A}"/>
  </g>`
}
const gradDef = `<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ACCENT_A}"/><stop offset="1" stop-color="${ACCENT_B}"/></linearGradient>`

function banner(t) {
  const W = 980, H = 250
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="notion-listen: comment on a Notion page, and a Claude Code agent does it">
  <defs>${gradDef}</defs>
  ${logo(W / 2 - 40, 16, 80)}
  <text x="${W / 2}" y="160" text-anchor="middle" font-family="${SANS}" font-size="54" font-weight="800" letter-spacing="-1.5" fill="${t.text}">notion-listen</text>
  <text x="${W / 2}" y="204" text-anchor="middle" font-family="${SANS}" font-size="21" fill="${t.muted}">Comment on a Notion page. A Claude Code agent does it.</text>
</svg>
`
}

// --- animated demo ------------------------------------------------------------
// One 20 s loop on a Notion-like page, in two acts:
//  1. You ask a question on a list -> 👀 -> 🤔 -> the agent answers in the thread -> ✅
//  2. You follow up in the same thread -> 👀 -> 🤔 -> only the format changes
//     (list -> table) -> ✅. Reactions replace each other, like the real ones.
const LOOP = 20
function appear(name, start) { // fade in at start%, stay, fade out at the loop end
  return `@keyframes ${name}{0%,${start}%{opacity:0;transform:translateY(4px)}${start + 1.5}%,94%{opacity:1;transform:none}98%,100%{opacity:0}}`
}
function between(name, from, to) { // visible only from from% to to%
  return `@keyframes ${name}{0%,${from}%{opacity:0;transform:scale(.6)}${from + 1.2}%,${to}%{opacity:1;transform:none}${to + 1}%,100%{opacity:0;transform:scale(.6)}}`
}

// Notion-like palettes (a look-alike, not Notion's UI).
const NOTION = {
  light: { page: '#FFFFFF', side: '#F7F7F5', text: '#37352F', muted: '#787774', faint: '#E9E9E7', sel: '#EBEBEA', border: '#E9E9E7', hlBg: '#FFD400', hlBgOp: 0.24, hlLine: '#F5C518', hlLineOp: 1, card: '#FFFFFF', chip: '#F1F1EF', chipOn: 'rgba(35, 131, 226, 0.10)', chipOnLine: 'rgba(35, 131, 226, 0.55)', head: '#F7F7F5', shadow: 0.12 },
  dark: { page: '#191919', side: '#202020', text: '#D4D4D4', muted: '#9B9B9B', faint: '#2F2F2F', sel: '#2C2C2C', border: '#373737', hlBg: '#FFD400', hlBgOp: 0.16, hlLine: '#FFD400', hlLineOp: 0.6, card: '#252525', chip: '#2F2F2F', chipOn: 'rgba(35, 131, 226, 0.18)', chipOnLine: 'rgba(82, 156, 236, 0.7)', head: '#202020', shadow: 0.45 },
}

function demo(t, mode) {
  const n = NOTION[mode]
  const W = 980, H = 555
  const win = { x: 20, y: 20, w: 590, h: 515 }
  const term = { x: 630, y: 20, w: 330, h: 515 }
  const L = win.x + 64 // text left edge
  const NFONT = `ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, 'Apple Color Emoji', Arial, sans-serif`

  const css = [
    `@keyframes hl{0%,4%{opacity:0}5.5%,64%{opacity:1}66%,100%{opacity:0}}`,
    `@keyframes oldl{0%,64%{opacity:1}66.5%,97%{opacity:0}100%{opacity:1}}`,
    appear('tbl', 66),
    appear('q', 7), appear('ans', 31), appear('fu', 44),
    between('qa', 16, 22), between('qb', 22, 33), appear('qc', 33),
    between('fa', 53, 57.5), between('fb', 57.5, 68.5), appear('fc', 69),
    ...['t3:10', 't4:13', 't5:16', 't6:22', 't7:31', 't8:33', 't10:47', 't11:50', 't12:53', 't13:66', 't14:69']
      .map(s => s.split(':')).map(([k, v]) => appear(k, Number(v))),
    `@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}`,
    `.chip{transform-box:fill-box;transform-origin:center}`,
  ].join('\n')
  const anim = (name, extra = '') => `style="animation:${name} ${LOOP}s ease-out infinite${extra}"`
  const txt = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-family="${NFONT}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`

  const lights = `<circle cx="${win.x + 20}" cy="${win.y + 22}" r="5" fill="#FF5F57"/><circle cx="${win.x + 37}" cy="${win.y + 22}" r="5" fill="#FEBC2E"/><circle cx="${win.x + 54}" cy="${win.y + 22}" r="5" fill="#28C840"/>`

  // top bar + page
  const top = `${txt(win.x + 76, win.y + 27, '🚀 <tspan fill="' + n.text + '">Launch plan</tspan>', 13, n.muted)}
  ${txt(win.x + win.w - 18, win.y + 27, 'Share   💬   ☆   ···', 13, n.muted, 'text-anchor="end"')}`
  const items = [['Billing page', 'Aug 4'], ['Team invites', 'Aug 18'], ['Dark mode', 'Sep 1']]
  const ly = i => win.y + 166 + i * 24
  const item = ([a, b]) => `${esc(a)} — ${esc(b)}`
  // The highlighted copy sits exactly on top of the plain text; its filter paints
  // the yellow box and underline from the text's own bounds, so it always fits.
  const list = `<g ${anim('oldl')}>${items.map((it, i) => txt(L, ly(i), '•', 15, n.text) + txt(L + 16, ly(i), item(it), 15, n.text)).join('')}
    <g ${anim('hl')}>${items.map((it, i) => txt(L + 16, ly(i), item(it), 15, n.text, 'filter="url(#hlf)"')).join('')}</g>
  </g>`
  const TW = 300, C1 = 190, RHt = 24, ty = win.y + 146
  const table = `<g ${anim('tbl')}>
    <rect x="${L}" y="${ty}" width="${TW}" height="${RHt}" fill="${n.head}"/>
    ${[0, 1, 2, 3, 4].map(r => `<line x1="${L}" y1="${ty + r * RHt}" x2="${L + TW}" y2="${ty + r * RHt}" stroke="${n.border}"/>`).join('')}
    ${[0, C1, TW].map(c => `<line x1="${L + c}" y1="${ty}" x2="${L + c}" y2="${ty + 4 * RHt}" stroke="${n.border}"/>`).join('')}
    ${txt(L + 10, ty + 17, 'Feature', 14, n.text, 'font-weight="600"')}${txt(L + C1 + 10, ty + 17, 'Date', 14, n.text, 'font-weight="600"')}
    ${items.map(([a, b], i) => txt(L + 10, ty + (i + 1) * RHt + 17, esc(a), 14, n.text) + txt(L + C1 + 10, ty + (i + 1) * RHt + 17, esc(b), 14, n.text)).join('')}
  </g>`
  const page = `${txt(L - 2, win.y + 84, '🚀', 34)}
  ${txt(L, win.y + 124, 'Launch plan', 28, n.text, 'font-weight="700" letter-spacing="-0.4"')}
  ${list}${table}`

  // the discussion thread
  const cx = L - 14, cy = win.y + 250, cw = 420
  const chip = (name, x, y, emoji, on) => `<g class="chip" ${anim(name)}>
      <rect x="${x}" y="${y}" width="46" height="24" rx="12" fill="${on ? n.chipOn : n.chip}" stroke="${on ? n.chipOnLine : 'none'}"/>
      ${txt(x + 10, y + 17, emoji, 13)}${txt(x + 32, y + 17, '1', 12, on ? '#2383E2' : n.muted, 'font-weight="600"')}
    </g>`
  const you = (y, when, text) => `<circle cx="${cx + 28}" cy="${y}" r="12" fill="#E16259"/>${txt(cx + 28, y + 4.5, 'Y', 12, '#FFFFFF', 'text-anchor="middle" font-weight="700"')}
    ${txt(cx + 48, y + 4, `<tspan font-weight="600" fill="${n.text}">You</tspan>  <tspan fill="${n.muted}">${when}</tspan>`, 13, n.muted)}
    ${txt(cx + 48, y + 26, esc(text), 15, n.text)}`
  const thread = `<g ${anim('q')}>
    <g filter="url(#card)"><rect x="${cx}" y="${cy}" width="${cw}" height="96" rx="8" fill="${n.card}" stroke="${n.border}">
      <animate attributeName="height" dur="${LOOP}s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.29;0.31;0.42;0.44;0.985;1" values="96;96;172;172;248;248;96"
        keySplines="0 0 1 1;.3 0 .2 1;0 0 1 1;.3 0 .2 1;0 0 1 1;0 0 1 1"/>
    </rect></g>
    ${you(cy + 26, '2m ago', 'Which of these is the riskiest?')}
    ${chip('qa', cx + 48, cy + 60, '👀', false)}${chip('qb', cx + 48, cy + 60, '🤔', false)}${chip('qc', cx + 48, cy + 60, '✅', true)}
  </g>
  <g ${anim('ans')}>
    <g transform="translate(${cx + 16} ${cy + 96})">${logo(0, 0, 24)}</g>
    ${txt(cx + 48, cy + 113, `<tspan font-weight="600" fill="${n.text}">notion-listen</tspan>  <tspan fill="${n.muted}">1m ago</tspan>`, 13, n.muted)}
    ${txt(cx + 48, cy + 135, 'Team invites: it depends on the new', 15, n.text)}
    ${txt(cx + 48, cy + 155, 'sign-in flow, which isn’t done yet.', 15, n.text)}
  </g>
  <g ${anim('fu')}>
    ${you(cy + 184, 'just now', 'Turn the list into a table.')}
    ${chip('fa', cx + 48, cy + 212, '👀', false)}${chip('fb', cx + 48, cy + 212, '🤔', false)}${chip('fc', cx + 48, cy + 212, '✅', true)}
  </g>`

  // terminal
  const termLine = (i, content, a = '') =>
    `<text x="${term.x + 18}" y="${term.y + 70 + i * 22}" font-family="${MONO}" font-size="12.2" fill="${TERM.text}" ${a}>${content}</text>`
  const span = (color, s) => `<tspan fill="${color}">${esc(s)}</tspan>`
  const terminal = `<g filter="url(#sh)"><rect x="${term.x}" y="${term.y}" width="${term.w}" height="${term.h}" rx="12" fill="${TERM.bg}" stroke="${TERM.border}"/></g>
  <circle cx="${term.x + 20}" cy="${term.y + 18}" r="5" fill="#FF5F57"/><circle cx="${term.x + 37}" cy="${term.y + 18}" r="5" fill="#FEBC2E"/><circle cx="${term.x + 54}" cy="${term.y + 18}" r="5" fill="#28C840"/>
  <text x="${term.x + term.w / 2}" y="${term.y + 22}" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${TERM.dim}">~/launch-site</text>
  ${termLine(0, span(TERM.green, '$ ') + span(TERM.text, 'notion-listen notion.so/Launch-pl…'))}
  ${termLine(1, span(TERM.green, '● ') + span(TERM.text, 'listening to page 1a2b…'))}
  ${termLine(3, span(TERM.accent, '← ') + span(TERM.text, '“Which of these is the riskiest?”'), anim('t3'))}
  ${termLine(4, span(TERM.yellow, '⏺ ') + span(TERM.text, 'Agent d-9807b1dc ') + span(TERM.dim, '· sonnet'), anim('t4'))}
  ${termLine(5, span(TERM.dim, '  ⎿ ') + span(TERM.text, 'react 👀'), anim('t5'))}
  ${termLine(6, span(TERM.dim, '  ⎿ ') + span(TERM.text, 'react 🤔') + span(TERM.dim, ' · read ./notes/auth.md'), anim('t6'))}
  ${termLine(7, span(TERM.dim, '  ⎿ answered in the thread'), anim('t7'))}
  ${termLine(8, span(TERM.green, '  ✔ ') + span(TERM.text, 'react ✅'), anim('t8'))}
  ${termLine(10, span(TERM.accent, '← ') + span(TERM.text, '“Turn the list into a table.”'), anim('t10'))}
  ${termLine(11, span(TERM.yellow, '⏺ ') + span(TERM.text, 'same thread → d-9807b1dc'), anim('t11'))}
  ${termLine(12, span(TERM.dim, '  ⎿ ') + span(TERM.text, 'react 👀 → 🤔'), anim('t12'))}
  ${termLine(13, span(TERM.dim, '  ⎿ list → table, nothing else'), anim('t13'))}
  ${termLine(14, span(TERM.green, '  ✔ ') + span(TERM.text, 'react ✅ ') + span(TERM.dim, '· 9s'), anim('t14'))}
  <rect x="${term.x + 18}" y="${term.y + 70 + 16 * 22 - 12}" width="7.5" height="15" fill="${TERM.text}" ${anim('blink', ';animation-duration:1.1s;animation-timing-function:steps(1)')}/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Demo on a Notion-like page. You highlight a list and ask 'Which of these is the riskiest?'. Your comment gets an eyes reaction, then a thinking face while the agent reads your project notes, it answers in the thread, and the reaction becomes a check mark. You follow up in the same thread: 'Turn the list into a table.' The same agent picks it up, and only the format changes: the list becomes a table, then a check mark.">
  <defs>${gradDef}
    <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="${n.shadow}"/></filter>
    <filter id="hlf" x="-0.02" y="-0.04" width="1.04" height="1.16" primitiveUnits="objectBoundingBox">
      <feFlood flood-color="${n.hlBg}" flood-opacity="${n.hlBgOp}" x="-0.02" y="-0.04" width="1.04" height="1.04" result="bg"/>
      <feFlood flood-color="${n.hlLine}" flood-opacity="${n.hlLineOp}" x="-0.02" y="1.0" width="1.04" height="0.09" result="ln"/>
      <feMerge><feMergeNode in="bg"/><feMergeNode in="ln"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="card" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="${n.shadow * 0.8}"/></filter>
  </defs>
  <style>${css}</style>
  <g filter="url(#sh)"><rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="12" fill="${n.page}" stroke="${n.border}"/></g>
  ${lights}
  ${top}
  ${page}
  ${thread}
  ${terminal}
</svg>
`
}

// --- comparison matrix -----------------------------------------------------------
const COLS = [
  { name: 'Chat apps', sub: 'ChatGPT, Claude.ai' },
  { name: 'AI edits a file', sub: 'e.g. a .docx' },
  { name: 'Doc AI', sub: 'Notion AI, Copilot' },
  { name: 'Coding agents', sub: 'Claude Code, Cursor' },
  { name: 'notion-listen', sub: '', us: true },
]
export const ROWS = [
  ['Ask right on the text', [0, 0, 1, 0, 1]],
  ['A thread per request', [0, 0, 0.5, 0, 1]],
  ['Requests run in parallel', [0, 0, 0.5, 0.5, 1]],
  ['Keep writing meanwhile', [0.5, 0, 0.5, 0.5, 1]],
  ['Uses your code and tools', [0, 0.5, 0, 1, 1]],
  ['Answers where the team sees', [0, 0, 1, 0, 1]],
]

function mark(cx, cy, v, t) {
  if (v === 1) return `<circle cx="${cx}" cy="${cy}" r="12" fill="#22C55E"/><path d="M${cx - 5.5} ${cy}l3.8 4 7.2-8" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (v === 0.5) return `<circle cx="${cx}" cy="${cy}" r="10.5" fill="none" stroke="#F59E0B" stroke-width="2.4"/><path d="M${cx} ${cy - 10.5}a10.5 10.5 0 0 1 0 21z" fill="#F59E0B"/>`
  return `<circle cx="${cx}" cy="${cy}" r="12" fill="${t.chip}"/><path d="M${cx - 4.4} ${cy - 4.4}l8.8 8.8M${cx + 4.4} ${cy - 4.4}l-8.8 8.8" stroke="${t.muted}" stroke-width="2.2" stroke-linecap="round"/>`
}

function compare(t) {
  const W = 980, LABEL = 300, CW = 136, TOP = 24, HEAD = 74, RH = 52
  const H = TOP + HEAD + ROWS.length * RH + 58
  const colX = i => LABEL + i * CW + CW / 2
  const usX = LABEL + 4 * CW
  const bodyH = HEAD + ROWS.length * RH + 14
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparison of notion-listen with chat apps, AI that edits a file, built-in doc AI and coding agents. notion-listen is the only one with every capability.">
  <defs>${gradDef}
    <linearGradient id="usfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACCENT_A}" stop-opacity="0.16"/><stop offset="1" stop-color="${ACCENT_B}" stop-opacity="0.06"/></linearGradient>
  </defs>
  <style>@keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}</style>
  ${ROWS.map((_, r) => r % 2 === 0 ? `<rect x="0" y="${TOP + HEAD + r * RH}" width="${W}" height="${RH}" rx="10" fill="${t.zebra}"/>` : '').join('')}
  <rect x="${usX + 6}" y="${TOP - 10}" width="${CW - 12}" height="${bodyH}" rx="18" fill="url(#usfill)"/>
  <rect x="${usX + 6}" y="${TOP - 10}" width="${CW - 12}" height="${bodyH}" rx="18" fill="none" stroke="url(#grad)" stroke-width="2.5" style="animation:glow 3s ease-in-out infinite"/>`
  COLS.forEach((c, i) => {
    const x = colX(i)
    if (c.us) {
      s += logo(x - 16, TOP + 2, 32)
      s += `<text x="${x}" y="${TOP + 56}" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="800" fill="url(#grad)">${esc(c.name)}</text>`
    } else {
      s += `<text x="${x}" y="${TOP + 34}" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="800" fill="${t.text}">${esc(c.name)}</text>`
      s += `<text x="${x}" y="${TOP + 54}" text-anchor="middle" font-family="${SANS}" font-size="11.5" fill="${t.muted}">${esc(c.sub)}</text>`
    }
  })
  ROWS.forEach(([label, vals], r) => {
    const y = TOP + HEAD + r * RH
    s += `<text x="20" y="${y + RH / 2 + 6}" font-family="${SANS}" font-size="17" font-weight="600" fill="${t.text}">${esc(label)}</text>`
    vals.forEach((v, i) => { s += mark(colX(i), y + RH / 2, v, t) })
  })
  const fy = TOP + HEAD + ROWS.length * RH + 36
  s += `<g font-family="${SANS}" font-size="13" fill="${t.muted}">
    ${mark(28, fy - 4, 1, t)}<text x="48" y="${fy}">yes</text>
    ${mark(100, fy - 4, 0.5, t)}<text x="120" y="${fy}">partly</text>
    ${mark(190, fy - 4, 0, t)}<text x="210" y="${fy}">no</text>
    <text x="${W - 20}" y="${fy}" text-anchor="end">As of October 2026</text>
  </g>
</svg>
`
  return s
}

// --- the usual way vs notion-listen ------------------------------------------
function workflow(t) {
  const W = 980, H = 420, CW = 470, GAP = 40
  const L = 0, R = CW + GAP
  const node = (x, y, w, h, fill = t.page) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${t.border}"/>`
  const label = (x, y, txt, size = 13, weight = 700, fill = t.text, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${SANS}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(txt)}</text>`
  const bar = (x, y, w, fill = t.faint, op = 1) => `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="${fill}" opacity="${op}"/>`

  // Left: doc <-> one giant chat
  const chatMsgs = ['fix intro', 'a chart?', 'typo p.3', 'paste again?']
  let left = `${node(L, 0, CW, H, t.card)}
  ${label(L + 26, 44, '😩 The usual way', 21, 800)}
  ${node(L + 26, 76, 150, 200)}
  ${label(L + 42, 104, '📄 Your doc', 14)}
  ${bar(L + 42, 122, 110)}${bar(L + 42, 138, 90)}${bar(L + 42, 154, 116)}${bar(L + 42, 170, 70)}
  <rect x="${L + 38}" y="${200}" width="126" height="56" rx="10" fill="${t.badRed}"/>
  ${label(L + 101, 225, '🔒 Locked', 14, 800, t.badRedText, 'middle')}
  ${label(L + 101, 244, 'while AI edits', 12, 600, t.badRedText, 'middle')}
  ${node(L + 288, 76, 156, 254)}
  ${label(L + 302, 104, '💬 One giant chat', 14)}`
  chatMsgs.forEach((m, i) => {
    const y = 126 + i * 48, mine = i % 2 === 0
    const w = Math.min(130, 26 + m.length * 6.6)
    const x = mine ? L + 288 + 156 - 12 - w : L + 300
    left += `<rect x="${x}" y="${y}" width="${w}" height="28" rx="14" fill="${mine ? ACCENT_A : t.chip}" opacity="${0.45 + i * 0.18}"/>
    <text x="${x + w / 2}" y="${y + 18.5}" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${mine ? '#FFFFFF' : t.text}" opacity="${0.55 + i * 0.15}">${esc(m)}</text>`
  })
  left += `
  <path d="M${L + 178} 130 C ${L + 220} 100, ${L + 250} 100, ${L + 284} 130" fill="none" stroke="${t.muted}" stroke-width="2.2" stroke-dasharray="5 5" marker-end="url(#arrow)"/>
  ${label(L + 231, 98, 'copy', 13, 700, t.muted, 'middle')}
  <path d="M${L + 284} 300 C ${L + 250} 330, ${L + 210} 330, ${L + 160} 282" fill="none" stroke="${t.muted}" stroke-width="2.2" stroke-dasharray="5 5" marker-end="url(#arrow)"/>
  ${label(L + 226, 342, 'paste back', 13, 700, t.muted, 'middle')}
  ${label(L + 26, 388, '↻ Switch, paste, repeat.', 17, 700, t.text)}`

  // Right: comments -> parallel agents <- your machine
  const asks = [
    { y: 128, color: '#F97316', title: '✍️  Rewrite' },
    { y: 196, color: '#06B6D4', title: '📊  Chart' },
    { y: 264, color: '#22C55E', title: '🔤  Typos' },
  ]
  let right = `${node(R, 0, CW, H, t.card)}
  <rect x="${R}" y="0" width="${CW}" height="${H}" rx="14" fill="none" stroke="url(#grad)" stroke-width="2.5"/>
  ${label(R + 26, 44, '✨ With notion-listen', 21, 800, 'url(#grad)')}
  ${node(R + 26, 76, 196, 254)}
  ${label(R + 42, 104, '📄 Your doc', 14)}`
  asks.forEach((a, i) => {
    right += `${bar(R + 42, a.y - 12, 150)}<rect x="${R + 40}" y="${a.y}" width="140" height="12" rx="3" fill="${a.color}" opacity="0.3"/>${bar(R + 42, a.y + 2, 136)}${bar(R + 42, a.y + 18, 96)}
    <circle cx="${R + 206}" cy="${a.y + 6}" r="10" fill="${a.color}"/><text x="${R + 206}" y="${a.y + 10.5}" text-anchor="middle" font-family="${SANS}" font-size="12" font-weight="800" fill="#FFFFFF">${i + 1}</text>
    <path d="M${R + 217} ${a.y + 6} L ${R + 268} ${a.y + 6}" stroke="${a.color}" stroke-width="2.4" stroke-dasharray="6 6" style="animation:flow 1.2s linear infinite"/>
    <rect x="${R + 270}" y="${a.y - 14}" width="172" height="40" rx="20" fill="${t.page}" stroke="${a.color}" stroke-width="1.8"/>
    <circle cx="${R + 292}" cy="${a.y + 6}" r="6.5" fill="none" stroke="${a.color}" stroke-width="2.4" stroke-dasharray="24 17" style="transform-origin:${R + 292}px ${a.y + 6}px;animation:spin ${1.1 + i * 0.25}s linear infinite"/>
    ${label(R + 308, a.y + 11, a.title, 15, 800)}`
  })
  right += `
  ${label(R + 356, 98, 'in parallel', 12.5, 700, t.muted, 'middle')}
  <rect x="${R + 270}" y="300" width="172" height="34" rx="17" fill="${t.chip}"/>
  ${label(R + 356, 322, '💻 Your code & tools', 13, 800, t.text, 'middle')}
  <path d="M${R + 356} 298 L ${R + 356} 292" stroke="${t.muted}" stroke-width="2" stroke-dasharray="3 3"/>
  ${label(R + 26, 388, '✓ One agent per comment.', 17, 700, t.text)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The usual way: copy text from your doc into one giant chat and paste it back, with the doc locked while AI edits it. With notion-listen: each comment gets its own agent, running in parallel with your code and tools.">
  <defs>${gradDef}<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${t.muted}"/></marker></defs>
  <style>@keyframes flow{to{stroke-dashoffset:-24}}@keyframes spin{to{transform:rotate(360deg)}}</style>
  ${left}
  ${right}
</svg>
`
}

const extra = {
  light: { chip: '#F3F4F6', zebra: '#F9FAFB', badRed: '#FEE2E2', badRedText: '#B91C1C' },
  dark: { chip: '#2A2A30', zebra: '#1C1C20', badRed: 'rgba(239, 68, 68, 0.18)', badRedText: '#FCA5A5' },
}
for (const [name, t0] of Object.entries(themes)) {
  const t = { ...t0, ...extra[name] }
  writeFileSync(join(out, `banner-${name}.svg`), banner(t))
  writeFileSync(join(out, `demo-${name}.svg`), demo(t, name))
  writeFileSync(join(out, `compare-${name}.svg`), compare(t))
  writeFileSync(join(out, `workflow-${name}.svg`), workflow(t))
}
console.log('wrote assets/{banner,demo,compare,workflow}-{light,dark}.svg')
