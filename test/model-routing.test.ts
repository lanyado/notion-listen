// Run: npx tsx test/model-routing.test.ts
// Pure-function tests for suggestModel. No network, no Notion, no side effects.
import { suggestModel, type SuggestedModel } from '../src/lib.ts'

let pass = 0
let fail = 0

function check(comment: string, anchored: string, expected: SuggestedModel, note: string) {
  const got = suggestModel(comment, anchored)
  if (got === expected) {
    pass++
  } else {
    fail++
    console.error(`FAIL [${note}] want=${expected} got=${got}  comment=${JSON.stringify(comment.slice(0, 50))}`)
  }
}

// --- haiku: trivial -------------------------------------------------------
check('test 123', '', 'haiku', 'test ping en')
check('בדיקה', '', 'haiku', 'test ping he')
check('👀', '', 'haiku', 'bare emoji')
check('✅✅', '', 'haiku', 'multi emoji')
check('typo: teh', '', 'haiku', 'short non-question')
check('ok', '', 'haiku', 'tiny ack')

// --- opus: complex --------------------------------------------------------
check('restructure the whole page into three sections', '', 'opus', 'restructure')
check('renumber all the chapters', '', 'opus', 'renumber')
check('make this consistent with the intro', '', 'opus', 'consistency')
check('fix this everywhere it appears', '', 'opus', 'everywhere')
check('analyze the results and compare to table 2', '', 'opus', 'analyze')
check('rewrite the discussion', '', 'opus', 'rewrite')
// long anchored context pushes to opus even without keywords
check('tighten this', 'x'.repeat(700), 'opus', 'long anchored block')

// --- sonnet: the middle default ------------------------------------------
check('change "big" to "large" here', '', 'sonnet', 'simple local edit')
check('add a comma after the first clause', '', 'sonnet', 'small grammar edit')
check('why did you pick this phrasing?', '', 'sonnet', 'short question -> not haiku')
check('is this correct?', '', 'sonnet', 'question under 15 chars stays sonnet')
check('move the second paragraph up', '', 'sonnet', 'local move')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
