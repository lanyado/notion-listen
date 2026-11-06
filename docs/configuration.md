# Configuration

## Settings

`notion-listen setup` writes your settings to
`~/.config/notion-listen/config.env`. Run it again to change them (it offers your
current values as defaults), or edit the file directly. Changes apply the next
time you start a session.

| Setting | Default | What it does |
|---|---|---|
| `NOTION_TOKEN` | *(required)* | The secret of your Notion internal integration |
| `NOTION_ALLOWED_AUTHORS` | anyone | Comma-separated Notion user ids whose comments the agent acts on |
| `NGROK_DOMAIN` | random URL | Your free static ngrok domain, e.g. `my-name.ngrok-free.app` |
| `NOTION_LISTEN_PORT` | `8788` | Local port for incoming webhooks |
| `NOTION_VERIFICATION_TOKEN` | *(set by setup)* | The webhook signing secret Notion sends during verification |
| `NOTION_TOKEN_V2`, `NOTION_SPACE_ID`, `NOTION_ACTOR_ID` | off | [Emoji reactions](#emoji-reactions-optional) |

A variable set in your shell takes precedence over the file. For example,
`NOTION_LISTEN_PORT=9000 notion-listen <url>` overrides the port for one session.

### The Notion integration

Create an **internal integration** at
[notion.so/profile/integrations](https://www.notion.so/profile/integrations)
with these capabilities:

- **Read content**: to read the highlighted block and the page outline
- **Read comments** and **Insert comments**: to read your comment and reply
- **Read user information** (no email needed): so setup can list people for the allowlist

Then share each page you want to use with it: open the page in Notion and go to
**••• → Connections → add your integration**.

The agent makes its page edits through the hosted
[Notion MCP server](https://developers.notion.com/docs/mcp), signed in as you.
The first time, type `/mcp` in the Claude Code session and sign in to
**notion**.

### The webhook

In your integration's settings, open **Webhooks → Create subscription**:

- **URL**: `https://<your NGROK_DOMAIN>/notion-webhook` (setup prints it)
- **Events**: Comment created (only; an existing subscription with Comment updated also works, those events are ignored)

Notion then sends a verification code to that URL. `notion-listen setup` waits
for it, shows it, and saves it. Paste it into Notion's **Verify** dialog. To
verify a new subscription later, run `notion-listen setup` again and answer
"yes" at the webhook step.

## Agent behavior

Three files shape what the agent does. To customize one, copy it into
`~/.config/notion-listen/` under the same name and edit the copy. Your copy
wins, and `notion-listen update` never touches it. Don't edit the files in the
install itself, because local changes there stop updates.

| File | Copy to | Controls |
|---|---|---|
| [`config/claude-settings.json`](../config/claude-settings.json) | `~/.config/notion-listen/claude-settings.json` | Claude Code permissions for listener sessions. By default, Notion tools and file edits are auto-approved and shell commands ask first |
| [`prompts/worker.md`](../prompts/worker.md) | `~/.config/notion-listen/worker.md` | How each agent works and replies: what it fetches, tone, length, language, how it reports status |
| [`prompts/dispatcher.md`](../prompts/dispatcher.md) | `~/.config/notion-listen/dispatcher.md` | How the session queues comments and hands them to background agents |

For example:

```bash
cp ~/.notion-listen/prompts/worker.md ~/.config/notion-listen/worker.md
```

To let the agent run shell commands without asking, add rules to `allow` in
your copy of `claude-settings.json`, for example `"Bash(npm test)"`. Avoid
blanket rules such as `"Bash"`: anyone on the allowlist could then run any
command on your machine by commenting.

When the bundled files change in a new version, compare your copies with them
(see the [changelog](../CHANGELOG.md)).

## Emoji reactions (optional)

By default, the agent reports status with short text replies ("Done"). With
reactions on, it puts 👀 on your comment when it starts, 🤔 while it works,
and ✅ when it's done, with no extra messages in the thread.

Notion's public API has no reactions endpoint, so this replays the call the
Notion web app makes, authenticated with your **browser session cookie**. Be
aware that:

- `token_v2` gives **full access to your whole Notion account**. Treat it like a password.
- It's an unofficial endpoint. It may stop working without notice. The agent falls back to text replies if it does.
- The cookie expires when you log out of that browser session.

To turn it on, set these three values in `config.env`. You can find them in
your browser's developer tools while signed in to notion.so.

| Setting | Where to find it |
|---|---|
| `NOTION_TOKEN_V2` | The `token_v2` cookie for `www.notion.so` |
| `NOTION_SPACE_ID` | `spaceId` in the body of any `api/v3` request |
| `NOTION_ACTOR_ID` | Your user id: the `x-notion-active-user-header` request header |

## Installing

The one-line installer clones into `~/.notion-listen` and links the command
into `~/.local/bin`. Set `NOTION_LISTEN_HOME` or `NOTION_LISTEN_BIN` before
running it to change those folders.

To work from a clone instead (for development):

```bash
git clone https://github.com/lanyado/notion-listen.git
cd notion-listen
npm ci
npm link            # puts notion-listen on your PATH
notion-listen setup
```

## Project folders

When you start a session, notion-listen adds its server to the folder's
`.mcp.json` and leaves any other servers in the file alone. The entry contains
paths on your machine, so add `.mcp.json` to the project's `.gitignore` if you
don't already commit it.

## File locations

| Path | Contents |
|---|---|
| `~/.config/notion-listen/config.env` | Settings (override the folder with `NOTION_LISTEN_CONFIG_DIR` or `XDG_CONFIG_HOME`) |
| `~/.local/state/notion-listen/` | Logs and runtime files (`NOTION_LISTEN_STATE_DIR` or `XDG_STATE_HOME`) |
| `~/.notion-listen/` | The installed code (`NOTION_LISTEN_HOME` when installing) |

## Uninstall

```bash
notion-listen stop
rm -rf ~/.notion-listen ~/.local/bin/notion-listen
rm -rf ~/.config/notion-listen ~/.local/state/notion-listen   # settings and logs
```

Then:

- Remove the `# added by notion-listen` line from your shell's startup file
  (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile` or `~/.profile`), and the
  `noglob` alias if you added it.
- In each project you used it in, remove the `notion-channel` entry from
  `.mcp.json`.

If you installed to a custom location with `NOTION_LISTEN_HOME` or
`NOTION_LISTEN_BIN`, use those paths instead.
