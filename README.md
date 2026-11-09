<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
  <img alt="notion-listen: comment on a Notion page, and a Claude Code agent does it" src="assets/banner-light.svg" width="760">
</picture>

[![CI](https://github.com/lanyado/notion-listen/actions/workflows/ci.yml/badge.svg)](https://github.com/lanyado/notion-listen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-6366F1.svg)](LICENSE)
![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![macOS | Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
[![GitHub stars](https://img.shields.io/github/stars/lanyado/notion-listen?style=social)](https://github.com/lanyado/notion-listen/stargazers)

**[Quick start](#quick-start)** · [How it works](docs/how-it-works.md) · [Configuration](docs/configuration.md) · [FAQ](docs/faq.md) · [Troubleshooting](docs/troubleshooting.md)

</div>

https://github.com/user-attachments/assets/9c42d98f-5c06-43f4-87f6-3d87da114a50

Highlight text in Notion and comment. A Claude Code agent **on your machine,
inside your project** does the work and answers in the thread. You never leave
the doc, and you never stop writing.

## Why notion-listen?

No copy-pasting into a chat, no giant thread, no locked document, and an agent
that can actually use your code and tools.

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/workflow-dark.svg">
  <img alt="The usual way: copy from your doc into one giant chat and paste back, with the doc locked while an AI rewrites it. With notion-listen: each comment gets its own agent, running in parallel on your machine, answering on the page." src="assets/workflow-light.svg">
</picture>
</p>

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/compare-dark.svg">
  <img alt="Comparison: notion-listen versus chat apps (ChatGPT, Claude.ai), an AI editing a file, built-in doc AI (Notion AI, Copilot) and coding agents (Claude Code, Cursor). notion-listen is the only one that lets you ask right on the text, gives each request its own thread, runs requests in parallel while you keep writing, uses your code and tools, and answers where the team sees." src="assets/compare-light.svg">
</picture>
</p>

## Quick start

You need [Node.js 20+](https://nodejs.org), [Claude Code](https://docs.claude.com/en/docs/claude-code)
(claude.ai login or Console API key) and a free [ngrok](https://ngrok.com/download) account.

```bash
curl -fsSL https://raw.githubusercontent.com/lanyado/notion-listen/main/install.sh | bash
```

Using an AI agent? Point it at [INSTALL.md](INSTALL.md).

The installer runs a five-minute setup wizard. Then share a page with your
integration (**••• → Connections**) and start listening from your project:

```bash
cd ~/my-project
notion-listen "https://www.notion.so/My-Page-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
```

Claude Code asks you to confirm the development channel: choose **I am using
this for local development**. Then comment on the page, and watch it work.
First run? Type `/mcp` in Claude Code and sign in to **notion** so the agent can
edit pages.

## Usage

```
notion-listen <page-url>           Listen to a page from the current folder
notion-listen setup                Change settings
notion-listen doctor [page-url]    Check that everything is ready
notion-listen stop                 Stop the background webhook services now
notion-listen update               Update to the latest version
```

More pages? Run it again in another terminal, one page each, and close any of
them whenever you like. Settings live in `~/.config/notion-listen/config.env`. See
[Configuration](docs/configuration.md) to change permissions, tone and replies.
Something off? Run `notion-listen doctor`, then see
[Troubleshooting](docs/troubleshooting.md).

## Security

Comments become instructions to an agent that can edit your files, so only
people you choose can give them. Webhooks are signature-checked, and shell
commands always ask you first. See [SECURITY.md](SECURITY.md).

## Contributing

Ideas and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).
Built on [Claude Code channels](https://code.claude.com/docs/en/channels),
[MCP](https://modelcontextprotocol.io), the [Notion API](https://developers.notion.com)
and [ngrok](https://ngrok.com).

[MIT](LICENSE) © Rotem Lanyado
