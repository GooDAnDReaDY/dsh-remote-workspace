export const BOOTSTRAP_TEMPLATES = [
  {
    id: 'nodejs',
    name: 'Node.js & TypeScript',
    description: 'Installs Node.js LTS, npm, corepack, pnpm, and TypeScript compilers with build tools',
    script: `#!/usr/bin/env bash
set -euo pipefail
echo "=== Bootstrapping Node.js & TypeScript ==="
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -n -E bash -
  sudo -n apt-get install -y nodejs build-essential git
fi
echo "Configuring corepack & pnpm..."
corepack enable 2>/dev/null || npm install -g pnpm typescript
echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v 2>/dev/null || npm -v)"
echo "=== Node.js Bootstrap Completed ==="
`.trim()
  },
  {
    id: 'python',
    name: 'Python & FastAPI',
    description: 'Installs Python 3, pip, venv, and basic build essentials for modern Python web services',
    script: `#!/usr/bin/env bash
set -euo pipefail
echo "=== Bootstrapping Python & FastAPI ==="
sudo -n apt-get update -y
sudo -n apt-get install -y python3 python3-pip python3-venv git
echo "Python: $(python3 --version)"
echo "Pip: $(pip3 --version 2>/dev/null || echo 'pip not installed')"
echo "=== Python Bootstrap Completed ==="
`.trim()
  },
  {
    id: 'docker',
    name: 'Docker & Docker Compose',
    description: 'Installs Docker CE and Docker Compose plugin using official convenience script',
    script: `#!/usr/bin/env bash
set -euo pipefail
echo "=== Bootstrapping Docker CE ==="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo -n sh
  sudo -n usermod -aG docker "$USER" 2>/dev/null || true
fi
docker --version
echo "=== Docker Bootstrap Completed ==="
`.trim()
  }
];

export class BootstrapService {
  constructor(sshService) {
    this.sshService = sshService;
  }

  getTemplates() {
    return BOOTSTRAP_TEMPLATES;
  }

  getTemplate(id) {
    return BOOTSTRAP_TEMPLATES.find((t) => t.id === id) || null;
  }

  async runBootstrap(profile, options = {}) {
    if (!profile) throw new Error('Profile is required');
    let scriptToRun = options.script;
    if (options.templateId) {
      const tmpl = this.getTemplate(options.templateId);
      if (tmpl) scriptToRun = tmpl.script;
    }
    if (!scriptToRun && profile.bootstrapScript) {
      scriptToRun = profile.bootstrapScript;
    }
    if (!scriptToRun || !scriptToRun.trim()) {
      throw new Error('No bootstrap script or template provided');
    }

    const start = Date.now();
    const timeout = Number(options.timeout || options.timeoutSeconds) || 300;
    const res = await this.sshService.exec(profile, scriptToRun, {
      timeout,
      cleanAnsi: true,
      maxBufferSize: 256 * 1024
    });
    const durationMs = Date.now() - start;

    return {
      success: res.code === 0,
      code: res.code,
      stdout: res.stdout,
      stderr: res.stderr,
      durationMs
    };
  }
}
