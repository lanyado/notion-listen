# Install notion-listen

These instructions are for an AI coding agent installing
[notion-listen](https://github.com/lanyado/notion-listen) for a person.
notion-listen binds a Notion page to Claude Code on their machine, so a comment
on the page starts a background agent that does the work and answers in the thread.

**Never ask for a token or secret in chat.** The person enters them in the setup
wizard, in their own terminal, where the input is hidden.

## 1. Check the requirements

It runs on macOS or Linux (on Windows, use WSL). Check for each tool:

```bash
uname -s; git --version; node --version; npm --version; claude --version; ngrok version
```

Node.js must be version 20 or newer. If anything is missing, tell the person and
ask before installing it: [Node.js](https://nodejs.org),
[Claude Code](https://docs.claude.com/en/docs/claude-code),
[ngrok](https://ngrok.com/download).

## 2. Run the installer

Read [install.sh](https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh)
first if your rules require it, then run it with the wizard turned off:

```bash
curl -fsSL https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh | NOTION_LISTEN_NO_SETUP=1 bash
```

It installs into `~/.notion-listen`, links the command into `~/.local/bin`, and
adds that folder to `PATH` in their shell config if needed.

## 3. Hand over to the person

Stop here and give them these steps. You can't do them for them.

1. Open a **new terminal window** and run `notion-listen setup`. Don't use Claude
   Code's `!` prefix for this, because what they type could end up in the conversation.
2. Have these ready for the wizard:
   - A Notion internal integration token, from
     <https://www.notion.so/profile/integrations>, with the capabilities Read
     content, Read comments, Insert comments and Read user information.
   - A free ngrok account: its [authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
     and a [static domain](https://dashboard.ngrok.com/domains).
3. In Notion, open the page and share it with the integration: **••• → Connections**.

Wait until they say this is done.

## 4. Check the install

Ask for the page URL, then run:

```bash
"$HOME/.local/bin/notion-listen" doctor "<page-url>"
```

If it reports a problem, follow
[Troubleshooting](https://raw.githubusercontent.com/lanyado/notion-listen/main/docs/troubleshooting.md).

## 5. Tell them how to start

They run this themselves in a terminal, from the project the agent should work in:

```bash
cd <their-project>
notion-listen "<page-url>"
```

Then tell them:

- When Claude Code asks about the development channel, choose **I am using this
  for local development**.
- On the first run, type `/mcp` in Claude Code and sign in to **notion**, so the
  agent can edit pages.
- To try it, highlight text on the page and leave a comment.
