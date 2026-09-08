/**
 * DSH Remote Workspace Client Bundle
 * Pure Vanilla / React Web Component for DSH Settings and Workspace Header Slot
 */

const t = {
  en: {
    title: 'Remote Workspace',
    subtitle: 'Manage SSH connections, SFTP sync, and tunnels',
    addHost: 'Add Host',
    testConnection: 'Test Connection',
    latency: 'Latency',
    remoteOs: 'Remote OS',
    save: 'Save Profile',
    active: 'Active Workspace'
  },
  ru: {
    title: 'Удалённое рабочее пространство',
    subtitle: 'Управление подключениями по SSH, синхронизацией SFTP и туннелями',
    addHost: 'Добавить хост',
    testConnection: 'Проверить подключение',
    latency: 'Задержка',
    remoteOs: 'ОС сервера',
    save: 'Сохранить профиль',
    active: 'Активное пространство'
  }
};

export default function apply(ctx) {
  if (!ctx || !ctx.settings) return;

  ctx.settings.register('remote-workspace', {
    title: 'Remote Workspace',
    description: 'Connect to remote servers over SSH, edit code with SFTP, and sync mirrors.',
    category: 'workspace',
    component: 'RemoteWorkspaceCard'
  });

  // Register slot for active remote connection badge in DSH header
  if (ctx.slots && typeof ctx.slots.register === 'function') {
    ctx.slots.register('chat.header.right', {
      id: 'dsh-remote-status-badge',
      render: (props) => {
        return {
          type: 'div',
          className: 'dsh-remote-badge flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          children: '🌐 Remote: Ready'
        };
      }
    });
  }
}
