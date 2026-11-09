# Install notion-listen

These instructions are for an AI coding agent installing
[notion-listen](https://github.com/lanyado/notion-listen) for a person.
notion-listen binds a Notion page to Claude Code on their machine, so a comment
on the page starts a background agent that does the work and answers in the thread.

**Never ask for a token or secret in chat**, even when an error message says to
run a command with one. The person enters secrets in the setup wizard, in their
own terminal, where the input is hidden.

## 1. Check the requirements

It runs on macOS or Linux (on Windows, use WSL). Check for each tool:

```bash
uname -s; node --version
for t in git npm curl lsof claude ngrok; do command -v "$t" >/dev/null || echo "missing: $t"; done
claude auth status
```

- Node.js must be version 20 or newer.
- Claude Code must be signed in with a claude.ai account or a Console API key:
  notion-listen uses Claude Code channels, which don't work through Bedrock,
  Google Cloud or Foundry. On a claude.ai Team or Enterprise plan, an Owner must
  turn on Channels.
- If a tool is missing, tell the person and ask before installing it:
  - Claude Code: `curl -fsSL https://claude.ai/install.sh | bash`
  - ngrok: `brew install ngrok` on macOS; on Linux, see <https://ngrok.com/download>
  - Node.js: <https://nodejs.org>
  - git, curl and lsof: the system package manager, for example
    `apt-get update && apt-get install -y lsof` (with `sudo` unless you're root)

  Then run the check again. Claude Code's installer puts `claude` in
  `~/.local/bin`, which may not be on `PATH` until a new shell, so call it as
  `~/.local/bin/claude` if needed.

## 2. Run the installer

Read [install.sh](https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh),
then run it with the setup wizard turned off:

```bash
curl -fsSL https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh | NOTION_LISTEN_NO_SETUP=1 bash
```

It installs into `~/.notion-listen` and links the command into `~/.local/bin`.
For zsh and bash, it adds that folder to `PATH` in the shell config if it isn't
there yet. For other shells, tell the person to add `~/.local/bin` to their `PATH`.

## 3. Hand over to the person

Give them these steps, because they need the person's own accounts.

1. If `claude auth status` showed `"loggedIn": false`: run `claude`, type
   `/login`, and sign in.
2. Open a **new terminal** (not Claude Code's `!` prefix, which could put what
   they type into the conversation) and run `notion-listen setup`. The wizard asks for:
   - **Notion integration secret:** create an internal integration at
     <https://www.notion.so/profile/integrations> with Read content, Read
     comments, Insert comments, and Read user information (without email
     addresses is enough). Copy its "Internal Integration Secret".
   - **Who may instruct the agent:** comments become instructions to an agent
     on their machine, so pick only themselves and trusted teammates, not "all".
   - **ngrok:** the authtoken from <https://dashboard.ngrok.com/get-started/your-authtoken>,
     and optionally a free static domain from <https://dashboard.ngrok.com/domains>.
     Without a static domain, the webhook URL changes on every run.
   - **Webhook:** keep the wizard running. In the integration's **Webhooks**
     tab, create a subscription with the URL the wizard prints and the event
     **Comment created**. The wizard then prints a verification token to paste
     into Notion's **Verify** dialog.
3. In Notion, open the page and share it with the integration: **••• → Connections**.
4. When done, send you the page URL. No tokens.

## 4. Check the install

When they send the page URL, run:

```bash
"$HOME/.local/bin/notion-listen" doctor "<page-url>"
```

Items marked ✖ must be fixed, and each line says how. Items marked ! are
warnings and can stay. When the fix is signing in (`/login`) or
`notion-listen setup`, the person does it. If a line isn't clear, see
[Troubleshooting](https://raw.githubusercontent.com/lanyado/notion-listen/main/docs/troubleshooting.md).

## 5. Tell them how to start

They run this themselves in a terminal, from the project the agent should work in:

```bash
cd <their-project>
notion-listen "<page-url>"
```

Then tell them:

- It adds notion-listen's servers to `.mcp.json` in that folder. They can
  commit it or add it to `.gitignore`.
- When Claude Code asks about the development channel, choose **I am using this
  for local development**.
- On the first run, type `/mcp` in Claude Code and sign in to **notion** in the
  browser, so the agent can edit pages.
- To try it, highlight text on the page and leave a comment.

To remove it later, see [Uninstall](https://github.com/lanyado/notion-listen/blob/main/docs/configuration.md#uninstall).
