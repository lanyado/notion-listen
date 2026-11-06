# Troubleshooting

Start with the doctor. It checks your tools, settings, webhook, tunnel and page
access, and says how to fix each problem:

```bash
notion-listen doctor "<page-url>"
```

## Common problems

| Problem | Fix |
|---|---|
| **Comments don't arrive** | Run `notion-listen doctor`. The usual causes are an unverified webhook (re-run `notion-listen setup`) or a webhook URL that changed, which happens when you have no `NGROK_DOMAIN`. Also check that the subscription is active in your integration's **Webhooks** tab. Notion pauses subscriptions that keep failing |
| **Claude Code warns that channels aren't enabled** | On claude.ai Team and Enterprise plans, an Owner must enable **Channels** under *Organization settings → Claude Code*. Channels also don't work when Claude Code runs through Amazon Bedrock, Google Cloud or Microsoft Foundry |
| **"your integration can't see this page"** | In Notion, open the page and go to **••• → Connections**, then add your integration |
| **The agent can read but not edit the page** | In the Claude Code session, type `/mcp` and sign in to **notion** |
| **zsh: no matches found** | zsh treats the `?` in copied links as a wildcard. Quote the link, or run `notion-listen setup` to add the `noglob` alias |
| **"port 8788 is in use"** | Another program is using the port. Stop it, or set `NOTION_LISTEN_PORT` in your settings to use a different one |
| **ngrok did not start** | The error shows ngrok's code. `unknown flag: --url`: update ngrok (`ngrok update`). `ERR_NGROK_4018`: run `ngrok config add-authtoken <token>`. `ERR_NGROK_108`: a free account allows one ngrok session, so stop ngrok on your other machine. `ERR_NGROK_313`: the domain in `NGROK_DOMAIN` isn't yours, so check it at [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) |
| **Comments from a teammate are ignored** | They aren't in `NOTION_ALLOWED_AUTHORS`. Add them with `notion-listen setup`. The log shows each skipped author's id |
| **The command isn't found after installing** | Open a new terminal. The installer added `~/.local/bin` to your PATH in your shell's startup file |
| **`notion-listen` runs an old version** | An old `notion-listen` shell function in `~/.zshrc` may be hiding the command. `notion-listen doctor` detects this. Delete the function |
| **Emoji reactions stopped working** | Your `token_v2` cookie expired. Copy a new one from the browser, or remove the three reaction settings to use text replies |

## Logs

| Log | When to look |
|---|---|
| `~/.local/state/notion-listen/channel.log` | What each session received, queued, skipped or delivered, prefixed by its page id |
| `~/.local/state/notion-listen/router.log` | Which session each event was forwarded to, and when sessions came and went |
| `~/.local/state/notion-listen/ngrok.log` | Tunnel errors |

For example, to follow the listener live:

```bash
tail -f ~/.local/state/notion-listen/channel.log
```

## Still stuck?

[Open an issue](https://github.com/lanyado/notion-listen/issues/new/choose) and
include the output of `notion-listen doctor` (it never prints your tokens) and the
relevant log lines.
