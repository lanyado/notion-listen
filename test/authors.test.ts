// Run: npx tsx test/authors.test.ts
// Pure-function tests for the NOTION_ALLOWED_AUTHORS allowlist. No network.
import { parseAllowedAuthors, isAuthorAllowed } from '../src/lib.ts'

let pass = 0
let fail = 0

function check(raw: string, author: string | undefined, expected: boolean, note: string) {
  const got = isAuthorAllowed(author, parseAllowedAuthors(raw))
  if (got === expected) {
    pass++
  } else {
    fail++
    console.error(`FAIL [${note}] want=${expected} got=${got}  raw=${JSON.stringify(raw)} author=${author}`)
  }
}

const A = '3a1c5e2b-7d40-4f6b-bc09-5e1d9807b1dc'
const B = '9b2de91a-0000-4000-8000-000000000000'

// --- empty allowlist: everyone allowed (opt-in feature) --------------------
check('', A, true, 'empty list allows any author')
check('  ,  ', A, true, 'blank entries are ignored')
check('', undefined, true, 'empty list allows unknown author')

// --- set allowlist ---------------------------------------------------------
check(A, A, true, 'exact match')
check(A.replace(/-/g, ''), A, true, 'dashless list entry matches dashed id')
check(A.toUpperCase(), A, true, 'case-insensitive')
check(`${B}, ${A}`, A, true, 'second entry, spaces around comma')
check(B, A, false, 'other author rejected')
check(A, undefined, false, 'unknown author rejected when list is set')
check(A, '', false, 'empty author rejected when list is set')

console.log(`${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
