# Changelog

Notable changes to `@goodandready/dsh-remote-workspace`.

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
