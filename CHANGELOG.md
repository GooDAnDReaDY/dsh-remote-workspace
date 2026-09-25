# Changelog

Notable changes to `@goodandready/dsh-remote-workspace`.

## 0.3.10

### Security & Fixed
- **Session-aware connection authentication**: all API routes are guarded by `authorizeRequest()` using DSH `connection.requestRejection(req)`, failing closed (503) if connection is unavailable and rejecting non-loopback clients with forged Origin/Sec-Fetch headers (403/401) before calling sensitive services. (Refs: #72)
- **Bounded body reader**: `readBody()` checks `Content-Length` upfront, enforces a 5 MiB ceiling, and immediately stops accumulating chunks and removes listeners upon cap violation with HTTP 413, preventing memory exhaustion and OOM. (Refs: #73)
- **Timer lifecycle cleanup**: `clearInterval(idleTimer)` added to plugin `dispose` cleanup, preventing lingering background interval timers on plugin reload. (Refs: #74)

## 0.3.9

### Added
- **ProxyCommand and ProxyJump**: a profile can dial through an OpenSSH proxy command or a chain of bastions. The first jump uses the connection pool. Later jumps use their own connections and close when the target closes.
- **SSH agent and keyboard sign-in**: authentication can use an agent socket, Pageant, or `SSH_AUTH_SOCK`. A keyboard-interactive prompt appears on the settings card and expires after 60 seconds.
- **SSH config import**: importing `~/.ssh/config` follows `Include` and reports skipped wildcard, Match, duplicate, and missing-include blocks.
- **Host groups and cluster commands**: hosts can be grouped by environment or tag and tested together. `remote_cluster` runs one command across the hosts that match an environment, tags, and aliases, with up to 8 workers by default.
- **Compact host table**: `remote_hosts` gives the model a markdown table. Passwords, keys, and proxy commands are omitted.
- **Idle sessions**: a pooled SSH connection closes after 30 minutes without use. A tunnel or a running command keeps its connection.
- **Command reconnect**: a command that loses the connection before any output is tried up to three times. Output that already started, a command timeout, and `idempotent: false` are not retried.
- **Dedicated terminal**: each terminal opens its own SSH connection and closes it with the session.
- **Terminal font**: `terminalFontFamily` changes the terminal face. Characters that could alter the stylesheet are rejected.
- **Quieter polling**: the settings card waits while the browser tab is hidden and does not overlap status requests.
- **Browser file transfer**: a file can be uploaded or downloaded with byte progress and cancel. The limit is 512MB. An upload replaces the remote file only after the temporary upload finishes.
- **Center workspace**: a sidebar button opens hosts, terminal, files, containers, tunnels, and cluster in the center column. Leaving for chat hides the column and keeps the terminal buffer.

## 0.3.8

### Fixed
- **Connection test payload**: the Test button posts the profile fields, so the route receives `host` and can open SSH. (Refs: #52)
- **Loopback-only plugin update**: `POST` update accepts a loopback same-origin request with the update header. A private-network address alone is not trusted. (Refs: #53)
- **Design contract stays internal**: `docs/design/DESIGN.md` is no longer included in the npm package or the public GitHub tree. (Refs: #54)
- **Visible action errors**: save, delete, activation, directory browse, and tunnel stop show the server error in an alert. (Refs: #55)
- **Connection badge**: the card header reads `/dsh-remote-workspace/state` and no longer shows a permanent Ready label. (Refs: #56)
- **Shared chevron**: the header uses `IconChevronDownOutline14` when the primitives package provides it. (Refs: #57)
- **Settings modules**: profile, sync, and tunnel cards are separate client modules. (Refs: #58)
- **Tarball ignore**: `.gitignore` matches `*.tgz` without surrounding spaces. (Refs: #59)
- **Localized plugin-list label**: the list title comes from the English and Chinese dictionaries. (Refs: #60)
- **Updater version**: the row shows the installed version from the status response, or "Version unknown". It no longer prints a hardcoded `0.3.1`. (Refs: #61)

## 0.3.7

### Fixed
- **Clean npm pack output**: Suppressed compilation progress to stderr in `scripts/build-client.mjs`, ensuring `npm pack --dry-run --json` parses cleanly without JSON syntax errors. (Refs: #28)
- **File browsing API contract**: Resolved `remoteFs.list` method mismatch in `/browse` endpoint to use `remoteFs.listDir`, added backwards-compatible `RemoteFsService.prototype.list` alias, returned both `entries` and `items` along with `currentPath`, and supported inline draft profiles from settings modals. (Refs: #24)
- **Terminal session argument passing**: Fixed `POST /terminal/create` to pass `{ cols, rows }` options object to `createTerminalSession`, added positional parameter fallback in `SshService`, and added active profile fallback. (Refs: #29)
- **Shell metacharacter sanitization in tar sync**: Implemented POSIX `shellQuote` escaping in `TarSyncService` for all `remoteDir` paths, preventing command injection in `tar` and `mkdir` execution, with non-empty input validation. (Refs: #26)
- **Binary data integrity in mirror sync**: Handled file synchronizations with raw `Buffer` streams instead of forced `utf8` strings, preventing binary corruption of assets (images, archives, compiled artifacts), and added `.dsh-sync-snapshot.json` to default ignore list. (Refs: #27)
- **Performance in mirror sync push**: Deduplicated redundant sequential `mkdir -p` SSH executions during `push` operations via parent directory tracking Set. (Refs: #30)
- **CSRF loopback protection**: Eliminated loopback bypass in `isTrustedSettingsRequest` by rejecting requests where `Sec-Fetch-Site !== 'same-origin'`, and validating `Origin` against request `Host`. (Refs: #25)
- **Authorization token validation**: Enforced strict comparison of incoming Bearer and cookie tokens against configured server auth token (`DSH_AUTH_TOKEN` / `DSH_TOKEN`), rejecting arbitrary tokens and substrings from untrusted sources. (Refs: #32)
- **GET endpoints source authorization & credential masking**: Enforced `isTrustedSettingsRequest` across 5 sensitive read endpoints (`/state`, `/health`, `/docker/list`, `/terminal/stream`, `/tunnels/telemetry`), and added fallback credential masking (`••••••••`) when vault service is not configured. (Refs: #31)

## 0.3.6

### Fixed
- **Object-root JSON Schema for all remote tools**: Wrapped all 9 tool registrations (`remote_exec`, `remote_fs`, `remote_sync`, `remote_tunnel`, `remote_docker`, `remote_service`, `remote_transfer`, `remote_diagnose`, `remote_env`) with canonical `defineTool()` from `@deepseek-ai/dsh-tools`. Parameters are now compiled into standard JSON Schema objects with root `type: "object"`, preventing rejection by OpenAI-compatible LLM providers (`schema must be a JSON Schema of 'type: "object"', got 'type: null'`). Output schema standardized with `additionalProperties: true`. (Refs: #33)

## 0.3.5

### Fixed
- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item`. The view-aware card is now registered there
  (`id: 'dsh-remote-workspace'`, order 60, static label); the row seat and the legacy
  `settings.plugin.item` card stay as fallbacks. Sources edited in `src/client/entry.js`,
  `lib/client.js` regenerated.

## 0.3.4

### Fixed
- **Settings reachable again**: the card registered into `settings.plugin.item`, a
  slot the current DSH core (0.1.6-alpha.2) no longer renders, so the plugin's
  settings were unreachable. The surface now registers into the Plugins page row
  seat `plugins.row.config` first, keyed
  `@goodandready/dsh-remote-workspace#dsh-remote-workspace`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, open and without our card chrome — the
  host page draws the title, icon, crumb and padding) plus a one-line state for
  `view: 'summary'`. The legacy seat stays registered as a fallback for older cores.
- The change lives in `src/client/*` and the build prefix; `lib/client.js` is
  regenerated by `npm run build:client` (also run by `npm test`).

### Added
- This changelog.
