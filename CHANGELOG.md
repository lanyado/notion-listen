# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org).

## [1.0.0] - 2026-10-24

The first public release.

### Added

- `notion-listen <page-url>`: listen to a Notion page's comments from a project folder, with a background Claude Code agent per comment.
- Several pages at once: run it in more terminals, one page each. They share one webhook through a background router, which stops itself when the last session closes.
- `notion-listen setup`: a wizard for the Notion token, allowed people, ngrok domain and webhook verification.
- `notion-listen doctor`: checks tools, settings, webhook, tunnel and page access, and explains each fix.
- `notion-listen update` and a one-line installer.
- Author allowlist (`NOTION_ALLOWED_AUTHORS`).
- Optional emoji status reactions.
- Model suggestions per comment: fast for small edits, strongest for structural work.
- Precise inline edits: a comment on highlighted words changes only those words, in place, keeping bold, links and other comments' highlights.
### Security

- Webhook signatures are verified, and the verification handshake can't be replayed to replace the saved secret.
- Settings are stored outside the repo, readable only by you.

[1.0.0]: https://github.com/lanyado/notion-listen/releases/tag/v1.0.0
