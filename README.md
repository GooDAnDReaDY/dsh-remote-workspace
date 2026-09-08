# @goodandready/dsh-remote-workspace

Enterprise Remote Workspace Plugin for **DeepSeek Harness (DSH)**:
- 🚀 **Connection Pool**: High-performance SSH2 connection pool with keep-alive, auto-reconnect, and ping diagnostics.
- 📁 **SFTP Operations**: Streaming reads, atomic safe writes, remote directory trees, and stat.
- 🔄 **3-Way Mirror Sync**: Conflict-aware synchronization between remote directories and local mirrors with SHA-256 state tracking.
- 🌐 **SSH Tunneling**: Local and Reverse Port Forwarding directly integrated into DSH.
- 🤖 **Clean Model Tools**: Ergonomic, orthogonal tools (`remote_exec`, `remote_fs`, `remote_sync`, `remote_tunnel`) without prompt bloating.
- 🎨 **Native DSH UI**: Settings card, connection tester, and remote folder chooser designed according to `dsh-ui-design` standards.

## Installation

```bash
dsh plugin add @goodandready/dsh-remote-workspace
```

## Quick Start

1. Open **Settings** → **Remote Workspace**.
2. Add a host profile: Host, Port (default 22), Username, and Private Key or Password.
3. Click **Test Connection** to verify connectivity, measure latency, and detect the remote OS.
4. Set the host as active, specify the remote path, and start developing!
