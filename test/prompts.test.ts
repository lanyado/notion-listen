// Run: npx tsx test/prompts.test.ts
// Guards the worker rules that keep Notion text edits from failing or
// duplicating paragraphs. Notion's update_content matches the page markdown
// exactly, and that markdown wraps highlighted text in
// <span discussion-urls="..."> and formatting in tags like <b>. An old_str
// built from plain text (anchored_to, get_anchor_context) fails to match, and a
// worker that then inserts a rewritten paragraph duplicates it. No network.
import { readFileSync } from 'node:fs'
import { agentName } from '../src/lib.ts'

const worker = readFileSync(new URL('../prompts/worker.md', import.meta.url), 'utf8')
const dispatcher = readFileSync(new URL('../prompts/dispatcher.md', import.meta.url), 'utf8')

let pass = 0
let fail = 0
function check(ok: boolean, note: string) {
  if (ok) pass++
  else { fail++; console.error(`FAIL ${note}`) }
}

check(/build old_str from notion-fetch output only/i.test(worker), 'old_str comes from notion-fetch, not plain text')
check(/INCLUDING any tags inside it/.test(worker), 'old_str keeps markup verbatim')
check(/Keep every tag you copied in place/i.test(worker), 'new_str keeps the copied markup')
check(/NEVER use insert_content or replace_content for it/.test(worker), 'sentence edits never insert or replace the page')
check(/Never fall back to inserting/i.test(worker), 'no insert fallback after a failed match')
check(!/strip any <span>/i.test(worker), 'no rule telling workers to strip markup from old_str')
check(/fetch again before editing/i.test(worker), 'follow-ups refetch before editing')
check(/change ONLY the highlighted words/.test(worker), 'inline edits stay inside the highlight')
check(dispatcher.includes('{{WORKER_PROTOCOL_PATH}}'), 'dispatcher template points workers at the protocol file')

// Discussion ids on one page share their first 8 characters; names must not.
check(agentName('1a2b3c4d-0000-4000-8000-00000000aaaa') !== agentName('1a2b3c4d-0000-4000-8000-00000000bbbb'), 'agent names differ per discussion')
check(agentName('1a2b3c4d-0000-4000-8000-00000000aaaa') === agentName('1a2b3c4d00004000800000000000aaaa'), 'agent name ignores dashes')
check(/agent_name/.test(dispatcher), 'dispatcher uses the server-computed agent_name')

console.log(`prompts: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
