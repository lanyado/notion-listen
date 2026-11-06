# FAQ

## What can I ask?

Anything you'd ask a capable teammate who can see the page and your project:

| You comment on the page | The agent |
|---|---|
| "Shorten this to one sentence." | Rewrites the highlighted paragraph |
| "Add a table of the results in `results.csv`." | Reads the file and inserts a table |
| "Why is this number different from chapter 2?" | Checks both and answers in the thread |
| "Run the benchmark and update these numbers." | Runs your script (asking you first) and edits the page |
| "Fix the typos on this page." | Fixes them across the whole page |

Follow-ups in the same thread go to the same agent, which already has the context.

## What does it cost?

notion-listen is free. The agent uses your own Claude Code plan or API usage:
one session per page, a background agent per comment, and one short summary
of the page (a fast model) when a session starts. ngrok's free plan is enough.

## Can I listen to several pages at once?

Yes. Run `notion-listen <page-url>` in another terminal for each page, from the
project folder it belongs to. They share one webhook, and you can open or
close any of them at any time.

## Does my computer need to stay on?

Yes. The agent runs locally, in a terminal session you start. Comments posted
while it's off aren't picked up later.

## Can teammates comment too?

Yes. Add them in `notion-listen setup`. Only add people you'd trust to edit the
files in that folder.

## Is this an official Notion or Anthropic tool?

No. It's an independent open-source project. It relies on Claude Code
[channels](https://code.claude.com/docs/en/channels), which are a research
preview. They're loaded with `--dangerously-load-development-channels`, which
is why Claude Code shows a warning at startup.

## Does it work on Windows?

Not natively. It should work under WSL, but that isn't tested yet.

## Can I get emoji status reactions (👀 → ✅) instead of text replies?

Yes, as an opt-in. Notion's public API can't add reactions, so this uses your
browser session cookie. See [Configuration](configuration.md#emoji-reactions-optional)
for the trade-offs.
