# Security

notion-listen turns Notion comments into instructions for an AI agent that can
edit a page and the files in a local folder. Please read how it protects you,
and what you're responsible for.

## Reporting a vulnerability

Please report vulnerabilities privately, through
[GitHub's private vulnerability reporting](https://github.com/lanyado/notion-listen/security/advisories/new),
not in a public issue. We aim to reply within a week. Please allow reasonable
time for a fix before you disclose it.

## How it protects you

| Risk | Protection |
|---|---|
| Strangers instructing the agent | Only comments by people in `NOTION_ALLOWED_AUTHORS` are acted on. Setup asks you to choose them. Everyone else is skipped and logged |
| Forged webhooks | Every event must carry a valid `X-Notion-Signature` HMAC. The unsigned verification handshake is accepted only while no secret is saved, so someone who finds your tunnel URL can't replace it |
| Arbitrary commands | Shell commands always need your approval in the terminal. File edits and Notion tools are auto-approved, in the session's folder only |
| Untrusted MCP servers | Only the listener's own servers (and the hosted Notion server) are auto-approved. Other servers in a project's `.mcp.json` still go through Claude Code's normal approval prompt |
| The agent rewriting its own rules | Workers may read `prompts/worker.md`, but the install folder isn't added to the session, so they can't edit it |
| Leaked secrets | Settings are stored in `~/.config/notion-listen/config.env` with permissions `600`, outside the repo. Logs never contain tokens |
| Exposed ports | Servers listen on `127.0.0.1` only. The internet reaches them only through your ngrok tunnel |

## What you're responsible for

- **Who's on the allowlist.** Anyone on it can make the agent edit files in the
  folder you start it from. Treat adding someone like giving them write access
  to that folder.
- **Which folder you start it in.** Prefer a project folder, never your home
  folder.
- **Permissions you add.** Avoid blanket rules like `"Bash"` in your
  `claude-settings.json`, and never run listener sessions with
  `--dangerously-skip-permissions`.
- **Emoji reactions.** They use your Notion browser cookie (`token_v2`), which
  gives full access to your Notion account. They're off unless you set them.
- **Prompt injection.** Text on the page, and in files the agent reads, can try
  to steer it. The protections above limit what it can do, but review what it
  changes, especially on pages other people edit.
