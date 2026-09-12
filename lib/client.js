// Remote Workspace Settings Card (settings.plugin.item) & Session Utility Chip.
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-remote-workspace',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const NS = 'dsh-remote-workspace'

    function ensureCss() {
      if (typeof document === 'undefined') return
      if (document.getElementById('drw-clinebot-full-css')) return
      const style = document.createElement('style')
      style.id = 'drw-clinebot-full-css'
      style.dataset.dshPlugin = NS
      style.textContent = `
.drw-page{display:flex;flex-direction:column;gap:18px;padding:6px 0 24px;max-width:960px}
.drw-header{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.drw-header-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.drw-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px}
.drw-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.drw-header-badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center}

.drw-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:14px;list-style:none}
.drw-card-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between}
.drw-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}

.drw-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.drw-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px}
.drw-grid-4{display:grid;grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));gap:10px}

.drw-badge{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500;font-family:monospace}
.drw-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}
.drw-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}
.drw-badge-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}

.drw-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;width:100%;box-sizing:border-box}
.drw-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}
.drw-label{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-bottom:2px}
.drw-hint{font-size:11px;color:var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary));line-height:1.3}
.drw-field{display:flex;flex-direction:column;gap:3px;flex:1;min-width:180px}

.drw-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.drw-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}
.drw-btn:disabled{opacity:0.6;cursor:not-allowed}
.drw-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.drw-btn-primary:hover:not(:disabled){opacity:0.9}
.drw-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:rgba(239,68,68,0.3)}
.drw-btn-danger:hover:not(:disabled){background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.5)}

.drw-segmented{display:inline-flex;border-radius:8px;padding:2px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);gap:2px}
.drw-segmented-item{appearance:none;border:none;background:none;cursor:pointer;padding:5px 12px;font-size:12px;font-weight:500;border-radius:6px;color:var(--dsw-alias-label-secondary);transition:all .15s ease}
.drw-segmented-item-active{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,0.08);font-weight:600}

.drw-table{width:100%;border-collapse:collapse;margin-top:4px}
.drw-table th{text-align:left;font-size:12px;color:var(--dsw-alias-label-secondary);padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-weight:600}
.drw-table td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:13px;color:var(--dsw-alias-label-primary)}
.drw-table tr:hover{background:var(--dsw-alias-bg-layer-2)}

.drw-stat-box{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:3px}
.drw-stat-val{font-size:14px;font-weight:700;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drw-stat-lbl{font-size:11px;color:var(--dsw-alias-label-secondary)}
.drw-preview{padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;border:1px solid var(--dsw-alias-border-l2);line-height:1.4}

.drw-browser-modal{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:12px;display:flex;flex-direction:column;gap:8px;max-height:280px}
.drw-browser-list{overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:190px;padding-right:4px}
.drw-browser-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;font-family:monospace}
.drw-browser-item:hover{background:var(--dsw-alias-bg-layer-3)}

.drw-tabs{display:flex;gap:6px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:10px;margin-bottom:14px;overflow-x:auto}
.drw-tab-btn{appearance:none;border:1px solid transparent;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
.drw-tab-btn:hover{background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-primary)}
.drw-tab-btn.active{background:var(--dsw-alias-bg-layer-4);border-color:var(--dsw-alias-state-brand-primary);color:var(--dsw-alias-state-brand-primary)}

.drw-term-window{background:#0d1117;border:1px solid #30363d;border-radius:10px;display:flex;flex-direction:column;height:340px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.25)}
.drw-term-header{background:#161b22;padding:6px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #30363d;font-size:12px;color:#8b949e;font-family:monospace}
.drw-term-body{flex:1;padding:10px 12px;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px;line-height:1.45;color:#c9d1d9;white-space:pre-wrap;word-break:break-all}
.drw-term-footer{display:flex;background:#161b22;border-top:1px solid #30363d;padding:6px}
.drw-term-input{flex:1;background:transparent;border:none;color:#58a6ff;font-family:monospace;font-size:13px;padding:4px 8px;outline:none}

.drw-explorer-box{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:12px;display:flex;flex-direction:column;gap:10px}
.drw-explorer-nav{display:flex;align-items:center;gap:8px;font-family:monospace;font-size:12px;background:var(--dsw-alias-bg-layer-1);padding:6px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2)}
.drw-file-list{display:flex;flex-direction:column;gap:3px;max-height:260px;overflow-y:auto}
.drw-file-row{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-family:monospace;transition:background .1s ease}
.drw-file-row:hover{background:var(--dsw-alias-bg-layer-3)}
.drw-file-meta{display:flex;align-items:center;gap:12px;color:var(--dsw-alias-label-secondary);font-size:11.5px}

.drw-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.drw-modal-dialog{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;width:100%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.4)}
.drw-modal-hdr{padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;justify-content:space-between;font-weight:600}
.drw-modal-body{flex:1;padding:12px 16px;overflow-y:auto}

.drw-health-bar{display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font-size:11.5px;font-family:monospace}
.drw-health-item{display:flex;flex-direction:column;gap:2px}
.drw-progress{height:6px;background:var(--dsw-alias-bg-layer-1);border-radius:3px;overflow:hidden}
.drw-progress-fill{height:100%;border-radius:3px;transition:width .2s ease}

.drw-container-row{display:grid;grid-template-columns:2fr 2fr 1.5fr 1.5fr auto;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12.5px;font-family:monospace}
.drw-container-row:hover{background:var(--dsw-alias-bg-layer-3)}

      `
      document.head.appendChild(style)
    }

    const en = {
      title: 'Remote Workspace',
      subtitle: 'Native SSH connections, SFTP file access, 3-way mirror sync, and port forwarding tunnels.',
      status: 'Ready',

      tabProfiles: '🖥️ Host Profiles',

      tabContainers: '🐳 Containers',
      containersTitle: 'Remote Docker / Podman Engine',
      containerName: 'Container',
      containerImage: 'Image',
      containerStatus: 'Status',
      containerPorts: 'Ports',
      btnLogs: 'Logs',
      btnRestart: 'Restart',
      btnStop: 'Stop',
      noContainers: 'No active containers found or Docker daemon not running.',
      healthCpu: 'CPU: {val}%',
      healthMem: 'RAM: {val}% ({used}/{total} MB)',
      healthDisk: 'Disk: {val}%',
      healthUptime: 'Up: {val}',
      autoSyncTitle: 'Live Auto-Sync on Save',
      autoSyncDesc: 'Automatically push modified files to remote workspace on local save.',
      btnTransfer: 'Copy to Host...',
      transferTitle: 'Server-to-Server Direct Transfer',
      transferDestHost: 'Destination Server',
      transferDestPath: 'Destination File Path',
      transferBtnExec: 'Transfer Directly',
      transferSuccess: 'Successfully transferred {bytes} bytes to {host}:{path}',
      fJumpHost: 'Jump Host (Bastion)',
      fJumpHostNone: 'Direct Connection (No Jump Host)',

      tabTerminal: '⚡ Web Terminal',
      tabExplorer: '📂 File Explorer',
      tabTunnels: '🔗 Port Tunnels',
      tabSync: '🔄 Sync Station',
      vaultProtectedBadge: '🛡️ .env Vault Protected',
      termStart: 'Connect Terminal',
      termStop: 'Disconnect',
      termClear: 'Clear',
      termPlaceholder: 'Type command and press Enter (e.g. htop, ls, docker ps)...',
      termConnected: 'Connected to PTY session {id} on {host}',
      termDisconnected: 'Terminal disconnected.',
      explorerTitle: 'Remote Filesystem Explorer',
      filePreviewTitle: 'File Viewer: {path}',
      fileSize: '{size} KB',
      btnSaveFile: 'Save Changes',
      fileSaved: 'File saved successfully.',
      tunnelTraffic: 'RX: {rx} | TX: {tx}',
      tunnelUptime: 'Up: {sec}s',
      openLocalLink: '🌐 Open Local Port',
      badgeOnline: 'Active Host: {name} ({latency} ms)',
      badgeOffline: 'No active host',
      badgeTunnels: 'Tunnels: {count}',
      badgeKey: '🔑 Key Auth',
      badgePassword: '🔒 Password Auth',
      profilesTitle: '🖥️ Remote SSH Profiles',
      profilesDesc: 'Configure remote machines for code execution, SFTP browsing, and background mirror sync.',
      addBtn: '+ Add Host',
      nameCol: 'Name',
      hostCol: 'Host / User',
      portCol: 'Port',
      pathCol: 'Remote Workspace',
      actionsCol: 'Actions',
      noHosts: 'No remote hosts configured yet. Click "+ Add Host" to create your first connection.',
      activeBadge: 'Active',
      pinBtn: 'Pin Active',
      editBtn: 'Edit',
      delBtn: 'Delete',
      delConfirm: 'Delete host profile "{name}"?',
      formTitleNew: 'Add New Host Profile',
      formTitleEdit: 'Edit Host Profile',
      fName: 'Profile Name',
      fHost: 'Host / IP Address',
      fPort: 'Port',
      fUser: 'Username',
      fAuthType: 'Authentication Method',
      fAuthKey: 'SSH Private Key',
      fAuthPass: 'Password',
      fKeyPath: 'Private Key Path',
      fKeyPathHint: 'Path to ~/.ssh/id_rsa or /home/user/.ssh/id_ed25519',
      fPassphrase: 'Key Passphrase (optional)',
      fPassword: 'Account Password',
      fRemotePath: 'Remote Workspace Directory',
      fRemotePathHint: 'Absolute path on the server (e.g. /home/user/my-project)',
      fLocalMirror: 'Local Mirror Directory',
      fLocalMirrorHint: 'Local directory where files are mirrored for fast 3-way synchronization',
      btnBrowse: '📁 Browse Remote...',
      btnSelectThis: 'Select Directory',
      btnTest: '⚡ Test Connection (Ping)',
      btnSave: 'Save Profile',
      btnCancel: 'Cancel',
      testing: 'Testing Connection...',
      saving: 'Saving...',
      testOk: '✅ Connection OK! Latency: {latency} ms | OS: {os}',
      testFail: '❌ Connection Failed: {err}',
      diagTitle: '📊 Active Connection Diagnostics',
      diagDesc: 'Real-time telemetry and engine status for the currently selected remote machine.',
      diagProbeBtn: '⚡ Quick Probe',
      syncTitle: '🔄 Two-Way Workspace Mirror Sync',
      syncDesc: 'Fast 3-way conflict-aware file synchronization between local mirror and remote server.',
      pullBtn: '⬇️ Pull from Remote',
      pushBtn: '⬆️ Push to Remote',
      pulling: 'Pulling files…',
      pushing: 'Pushing files…',
      syncOk: 'Sync completed! Updated {count} file(s).',
      syncConflict: 'Conflict warning: {count} file(s) modified on both sides.',
      syncErr: 'Sync error: {err}',
      tunnelsTitle: '🔀 SSH Port Forwarding (Tunnels)',
      tunnelsDesc: 'Forward remote ports (e.g. databases, web servers, APIs) to your local machine via encrypted SSH tunnels.',
      tLocalPort: 'Local Port',
      tRemotePort: 'Remote Port',
      tOpenBtn: '+ Open Tunnel',
      tOpening: 'Opening…',
      tStopBtn: 'Stop',
      tNoTunnels: 'No active port forwarding tunnels.',
      tunnelsColId: 'Tunnel ID',
      tunnelsColRoute: 'Forwarding Route',
      tunnelsColActions: 'Actions',
      tOpenOk: 'Tunnel opened: 127.0.0.1:{localPort} -> Remote:{remotePort}',
      tOpenErr: 'Failed to open tunnel: {err}'
    }

    const ru = {
      title: 'Удалённое рабочее пространство',
      subtitle: 'SSH-подключения, доступ к файлам по SFTP, 3-way синхронизация зеркала и проброс портов.',
      status: 'Готово',
      badgeOnline: 'Активный хост: {name} ({latency} мс)',
      badgeOffline: 'Хост не выбран',
      badgeTunnels: 'Туннелей: {count}',
      badgeKey: '🔑 Авторизация по ключу',
      badgePassword: '🔒 Авторизация по паролю',
      profilesTitle: '🖥️ Профили SSH серверов',
      profilesDesc: 'Настройка удалённых серверов для запуска команд, SFTP-навигации и синхронизации зеркала.',
      addBtn: '+ Добавить хост',
      nameCol: 'Имя',
      hostCol: 'Хост / Пользователь',
      portCol: 'Порт',
      pathCol: 'Удалённый путь',
      actionsCol: 'Действия',
      noHosts: 'Удалённые хосты ещё не настроены. Нажмите «+ Добавить хост» для создания подключения.',
      activeBadge: 'Активен',
      pinBtn: 'Сделать активным',
      editBtn: 'Править',
      delBtn: 'Удалить',
      delConfirm: 'Удалить профиль хоста «{name}»?',
      formTitleNew: 'Добавление нового SSH хоста',
      formTitleEdit: 'Редактирование профиля хоста',
      fName: 'Название подключения',
      fHost: 'Хост / IP-адрес',
      fPort: 'Порт',
      fUser: 'Имя пользователя',
      fAuthType: 'Способ авторизации',
      fAuthKey: 'SSH-ключ',
      fAuthPass: 'Пароль',
      fKeyPath: 'Путь к приватному ключу',
      fKeyPathHint: 'Путь к ~/.ssh/id_rsa или /home/user/.ssh/id_ed25519',
      fPassphrase: 'Кодовая фраза ключа (если есть)',
      fPassword: 'Пароль учётной записи',
      fRemotePath: 'Удалённая папка проекта',
      fRemotePathHint: 'Абсолютный путь на сервере (например, /home/user/project)',
      fLocalMirror: 'Локальная папка зеркала',
      fLocalMirrorHint: 'Локальная папка для быстрого зеркалирования и бесконфликтной 3-way синхронизации',
      btnBrowse: '📁 Обзор на сервере…',
      btnSelectThis: 'Выбрать папку',
      btnTest: '⚡ Проверить связь (Ping)',
      btnSave: 'Сохранить профиль',
      btnCancel: 'Отмена',
      testing: 'Проверка соединения…',
      saving: 'Сохранение…',
      testOk: '✅ Соединение успешно! Задержка: {latency} мс | ОС: {os}',
      testFail: '❌ Ошибка подключения: {err}',
      diagTitle: '📊 Диагностика активного подключения',
      diagDesc: 'Телеметрия в реальном времени и состояние подсистемы для выбранного сервера.',
      diagProbeBtn: '⚡ Опросить сервер',
      syncTitle: '🔄 Двусторонняя синхронизация зеркала',
      syncDesc: 'Бесконфликтная 3-way синхронизация файлов между локальным зеркалом и сервером.',
      pullBtn: '⬇️ Скачать с сервера (Pull)',
      pushBtn: '⬆️ Загрузить на сервер (Push)',
      pulling: 'Скачивание файлов…',
      pushing: 'Загрузка файлов…',
      syncOk: 'Синхронизация завершена! Обновлено файлов: {count}.',
      syncConflict: 'Внимание: конфликт изменений в {count} файлах.',
      syncErr: 'Ошибка синхронизации: {err}',
      tunnelsTitle: '🔀 SSH-туннели (Port Forwarding)',
      tunnelsDesc: 'Проброс удалённых портов (базы данных, dev-серверы, API) на локальный компьютер через зашифрованный канал.',
      tLocalPort: 'Локальный порт',
      tRemotePort: 'Удалённый порт',
      tOpenBtn: '+ Открыть туннель',
      tOpening: 'Открытие…',
      tStopBtn: 'Закрыть',
      tNoTunnels: 'Нет активных туннелей проброса портов.',
      tunnelsColId: 'ID туннеля',
      tunnelsColRoute: 'Маршрут перенаправления',
      tunnelsColActions: 'Действия',
      tOpenOk: 'Туннель запущен: 127.0.0.1:{localPort} -> Remote:{remotePort}',
      tOpenErr: 'Не удалось запустить туннель: {err}'
    }

    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = (dict && dict[key]) || (fallback && fallback[key]) || key
        if (vars && typeof val === 'string') {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
          }
        }
        return val
      }
    }

    function FallbackChevron() {
      return React.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }



    // --- Sub-component: Docker Containers Tab ---
    function ContainersTab(props) {
      const { activeProfile, t } = props
      const [containers, setContainers] = React.useState([])
      const [loading, setLoading] = React.useState(false)
      const [logsModal, setLogsModal] = React.useState(null)
      const [logsContent, setLogsContent] = React.useState('')
      const [logsLoading, setLogsLoading] = React.useState(false)

      const loadContainers = async () => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch(`/dsh-remote-workspace/docker/list?profileId=${activeProfile.id}`)
          const data = await res.json()
          if (data.ok && Array.isArray(data.containers)) {
            setContainers(data.containers)
          } else {
            setContainers([])
          }
        } catch (_) {}
        setLoading(false)
      }

      React.useEffect(() => {
        loadContainers()
      }, [activeProfile?.id])

      const handleAction = async (containerId, action) => {
        try {
          await fetch('/dsh-remote-workspace/docker/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, containerId, action })
          })
          await loadContainers()
        } catch (_) {}
      }

      const showLogs = async (containerId, name) => {
        setLogsModal({ id: containerId, name })
        setLogsLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/docker/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, containerId, tail: 150 })
          })
          const data = await res.json()
          setLogsContent(data.logs || '[No logs output]')
        } catch (err) {
          setLogsContent(`[Error: ${err.message}]`)
        }
        setLogsLoading(false)
      }

      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: '14px' } }, t('containersTitle')),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'drw-btn',
              onClick: loadContainers,
              disabled: loading
            },
            loading ? 'Refreshing...' : '🔄 Refresh'
          )
        ),
        React.createElement(
          'div',
          { style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px', overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-2)' } },
          React.createElement(
            'div',
            { className: 'drw-container-row', style: { fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', background: 'var(--dsw-alias-bg-layer-1)' } },
            React.createElement('span', null, t('containerName')),
            React.createElement('span', null, t('containerImage')),
            React.createElement('span', null, t('containerStatus')),
            React.createElement('span', null, t('containerPorts')),
            React.createElement('span', { style: { textAlign: 'right' } }, t('actionsCol'))
          ),
          containers.length === 0
            ? React.createElement('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)' } }, t('noContainers'))
            : containers.map((c) =>
                React.createElement(
                  'div',
                  { key: c.id, className: 'drw-container-row' },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                    React.createElement('span', { className: `drw-badge ${c.state === 'running' ? 'drw-badge-ok' : 'drw-badge-warn'}` }, c.state),
                    React.createElement('span', { style: { fontWeight: 600 } }, c.names)
                  ),
                  React.createElement('span', { style: { opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.image),
                  React.createElement('span', { style: { fontSize: '11px', opacity: 0.7 } }, c.status),
                  React.createElement('span', { style: { fontSize: '11px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis' } }, c.ports || '—'),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', gap: '4px', justifyContent: 'flex-end' } },
                    React.createElement(
                      'button',
                      { type: 'button', className: 'drw-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => showLogs(c.id, c.names) },
                      t('btnLogs')
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', className: 'drw-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => handleAction(c.id, 'restart') },
                      t('btnRestart')
                    ),
                    c.state === 'running'
                      ? React.createElement(
                          'button',
                          { type: 'button', className: 'drw-btn drw-btn-danger', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => handleAction(c.id, 'stop') },
                          t('btnStop')
                        )
                      : null
                  )
                )
              )
        ),
        // Container Logs Modal
        logsModal
          ? React.createElement(
              'div',
              { className: 'drw-modal-overlay', onClick: () => setLogsModal(null) },
              React.createElement(
                'div',
                { className: 'drw-modal-dialog', onClick: (e) => e.stopPropagation() },
                React.createElement(
                  'div',
                  { className: 'drw-modal-hdr' },
                  React.createElement('span', { style: { fontFamily: 'monospace' } }, `Docker Logs: ${logsModal.name} (${logsModal.id})`),
                  React.createElement('button', { type: 'button', className: 'drw-btn', onClick: () => setLogsModal(null) }, '✕')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-modal-body' },
                  React.createElement('pre', { style: { background: '#0d1117', color: '#c9d1d9', padding: '12px', borderRadius: '8px', fontSize: '12px', maxHeight: '420px', overflowY: 'auto', whiteSpace: 'pre-wrap' } }, logsLoading ? 'Fetching logs...' : logsContent)
                )
              )
            )
          : null
      )
    }

    // --- Sub-component: Web Terminal Tab ---
    function TerminalTab(props) {
      const { activeProfile, t } = props
      const [connected, setConnected] = React.useState(false)
      const [sessionId, setSessionId] = React.useState(null)
      const [output, setOutput] = React.useState('')
      const [cmdInput, setCmdInput] = React.useState('')
      const [loading, setLoading] = React.useState(false)
      const termEndRef = React.useRef(null)
      const evtSourceRef = React.useRef(null)

      React.useEffect(() => {
        if (termEndRef.current) {
          termEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, [output])

      React.useEffect(() => {
        return () => {
          if (evtSourceRef.current) {
            evtSourceRef.current.close()
          }
        }
      }, [])

      const handleConnect = async () => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/terminal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, cols: 80, rows: 24 })
          })
          const data = await res.json()
          if (data.ok && data.sessionId) {
            setSessionId(data.sessionId)
            setConnected(true)
            setOutput((prev) => prev + `\n[+] ` + t('termConnected', { id: data.sessionId, host: activeProfile.host }) + `\n`)

            // Connect SSE stream
            const es = new EventSource(`/dsh-remote-workspace/terminal/stream?sessionId=${data.sessionId}`)
            evtSourceRef.current = es
            es.onmessage = (e) => {
              try {
                const parsed = JSON.parse(e.data)
                if (parsed.chunk) {
                  setOutput((p) => p + parsed.chunk)
                }
              } catch (_) {}
            }
            es.onerror = () => {
              setOutput((p) => p + `\n[-] ` + t('termDisconnected') + `\n`)
              setConnected(false)
              es.close()
            }
          }
        } catch (err) {
          setOutput((p) => p + `\n[!] Connection error: ${err.message}\n`)
        }
        setLoading(false)
      }

      const handleDisconnect = async () => {
        if (sessionId) {
          try {
            await fetch('/dsh-remote-workspace/terminal/close', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            })
          } catch (_) {}
        }
        if (evtSourceRef.current) {
          evtSourceRef.current.close()
        }
        setConnected(false)
        setSessionId(null)
        setOutput((p) => p + `\n[-] ` + t('termDisconnected') + `\n`)
      }

      const sendCommand = async (e) => {
        if (e) e.preventDefault()
        if (!cmdInput || !sessionId) return
        const toSend = cmdInput + '\n'
        setCmdInput('')
        try {
          await fetch('/dsh-remote-workspace/terminal/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, data: toSend })
          })
        } catch (_) {}
      }

      const sendCtrlC = async () => {
        if (!sessionId) return
        try {
          await fetch('/dsh-remote-workspace/terminal/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, data: '\x03' })
          })
        } catch (_) {}
      }

      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            React.createElement('span', { style: { fontWeight: 600, fontSize: '14px' } }, 'SSH PTY Shell:'),
            React.createElement(
              'span',
              { className: `drw-badge ${connected ? 'drw-badge-ok' : 'drw-badge-warn'}` },
              connected ? `🟢 Online (${activeProfile?.host})` : '⚪ Idle'
            )
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            !connected
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-primary',
                    disabled: !activeProfile || loading,
                    onClick: handleConnect
                  },
                  loading ? 'Connecting...' : t('termStart')
                )
              : React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-danger',
                    onClick: handleDisconnect
                  },
                  t('termStop')
                ),
            connected
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    onClick: sendCtrlC
                  },
                  'Ctrl+C'
                )
              : null,
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'drw-btn',
                onClick: () => setOutput('')
              },
              t('termClear')
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'drw-term-window' },
          React.createElement(
            'div',
            { className: 'drw-term-header' },
            React.createElement('span', null, `terminal ~ ${activeProfile?.username || 'user'}@${activeProfile?.host || 'remote'}`),
            React.createElement('span', null, connected ? `Session: ${sessionId}` : 'Offline')
          ),
          React.createElement(
            'div',
            { className: 'drw-term-body' },
            output || (activeProfile ? `[i] Ready to connect to ${activeProfile.username || 'root'}@${activeProfile.host}. Click 'Connect Terminal'.` : `[!] No active host profile selected. Configure and activate a profile first.`),
            React.createElement('div', { ref: termEndRef })
          ),
          connected
            ? React.createElement(
                'form',
                { className: 'drw-term-footer', onSubmit: sendCommand },
                React.createElement('span', { style: { color: '#38bdf8', padding: '4px 6px', fontFamily: 'monospace' } }, '$'),
                React.createElement('input', {
                  className: 'drw-term-input',
                  type: 'text',
                  placeholder: t('termPlaceholder'),
                  value: cmdInput,
                  onChange: (e) => setCmdInput(e.target.value)
                }),
                React.createElement(
                  'button',
                  { type: 'submit', className: 'drw-btn', style: { padding: '2px 8px', fontSize: '11px' } },
                  'Send ↵'
                )
              )
            : null
        )
      )
    }

    // --- Sub-component: Remote File Explorer Tab ---
    function ExplorerTab(props) {
      const { activeProfile, t } = props
      const [currentPath, setCurrentPath] = React.useState(activeProfile?.remoteWorkspace || '/')
      const [entries, setEntries] = React.useState([])
      const [loading, setLoading] = React.useState(false)
      const [previewFile, setPreviewFile] = React.useState(null)
      const [previewContent, setPreviewContent] = React.useState('')
      const [editContent, setEditContent] = React.useState('')
      const [previewLoading, setPreviewLoading] = React.useState(false)
      const [saveStatus, setSaveStatus] = React.useState(null)

      const loadDir = async (dirPath) => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, remotePath: dirPath })
          })
          const data = await res.json()
          if (data.ok && Array.isArray(data.entries)) {
            setCurrentPath(dirPath)
            setEntries(data.entries)
          }
        } catch (_) {}
        setLoading(false)
      }

      React.useEffect(() => {
        if (activeProfile) {
          loadDir(activeProfile.remoteWorkspace || '/')
        }
      }, [activeProfile?.id])

      const handleNavUp = () => {
        const parts = currentPath.split('/').filter(Boolean)
        parts.pop()
        const parent = '/' + parts.join('/')
        loadDir(parent || '/')
      }

      const openFile = async (entry) => {
        const filePath = currentPath.endsWith('/') ? currentPath + entry.filename : currentPath + '/' + entry.filename
        setPreviewLoading(true)
        setPreviewFile(filePath)
        setSaveStatus(null)
        try {
          const res = await fetch('/dsh-remote-workspace/file/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, filePath })
          })
          const data = await res.json()
          if (data.ok) {
            setPreviewContent(data.content)
            setEditContent(data.content)
          } else {
            setPreviewContent(`[Error loading file: ${data.error || 'Failed'}]`)
            setEditContent('')
          }
        } catch (err) {
          setPreviewContent(`[Error: ${err.message}]`)
        }
        setPreviewLoading(false)
      }

      const handleSaveFile = async () => {
        if (!previewFile || !activeProfile) return
        setSaveStatus('saving')
        try {
          const res = await fetch('/dsh-remote-workspace/file/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, filePath: previewFile, content: editContent })
          })
          const data = await res.json()
          if (data.ok) {
            setSaveStatus('saved')
            setPreviewContent(editContent)
          } else {
            setSaveStatus('error')
          }
        } catch (_) {
          setSaveStatus('error')
        }
      }

      return React.createElement(
        'div',
        { className: 'drw-explorer-box' },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: '14px' } }, t('explorerTitle')),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'drw-btn',
              onClick: () => loadDir(currentPath),
              disabled: loading
            },
            loading ? 'Refreshing...' : '🔄 Refresh'
          )
        ),
        React.createElement(
          'div',
          { className: 'drw-explorer-nav' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'drw-btn',
              style: { padding: '2px 8px', fontSize: '11px' },
              onClick: handleNavUp,
              disabled: currentPath === '/' || loading
            },
            '⬆️ Up'
          ),
          React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, 'Path:'),
          React.createElement('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-state-brand-primary)' } }, currentPath)
        ),
        React.createElement(
          'div',
          { className: 'drw-file-list' },
          entries.length === 0
            ? React.createElement('div', { style: { padding: '16px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)' } }, loading ? 'Reading directory...' : 'Directory is empty.')
            : entries.map((e) =>
                React.createElement(
                  'div',
                  {
                    key: e.filename,
                    className: 'drw-file-row',
                    onClick: () => (e.isDirectory ? loadDir(currentPath.endsWith('/') ? currentPath + e.filename : currentPath + '/' + e.filename) : openFile(e))
                  },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    React.createElement('span', null, e.isDirectory ? '📁' : '📄'),
                    React.createElement('span', { style: { fontWeight: e.isDirectory ? 600 : 400 } }, e.filename)
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-file-meta' },
                    e.size !== undefined ? React.createElement('span', null, `${Math.round(e.size / 1024)} KB`) : null,
                    e.permissions ? React.createElement('span', { style: { opacity: 0.6 } }, e.permissions) : null
                  )
                )
              )
        ),
        // File Preview / Edit Modal
        previewFile
          ? React.createElement(
              'div',
              { className: 'drw-modal-overlay', onClick: () => setPreviewFile(null) },
              React.createElement(
                'div',
                { className: 'drw-modal-dialog', onClick: (e) => e.stopPropagation() },
                React.createElement(
                  'div',
                  { className: 'drw-modal-hdr' },
                  React.createElement('span', { style: { fontFamily: 'monospace' } }, t('filePreviewTitle', { path: previewFile })),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      style: { padding: '2px 8px' },
                      onClick: () => setPreviewFile(null)
                    },
                    '✕'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'drw-modal-body', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                  previewLoading
                    ? React.createElement('div', { style: { padding: '20px', textAlign: 'center' } }, 'Loading content...')
                    : React.createElement('textarea', {
                        style: {
                          width: '100%',
                          height: '320px',
                          background: '#0d1117',
                          color: '#c9d1d9',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          padding: '10px',
                          border: '1px solid #30363d',
                          borderRadius: '8px',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        },
                        value: editContent,
                        onChange: (e) => setEditContent(e.target.value)
                      }),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                    React.createElement(
                      'span',
                      { style: { fontSize: '12px', color: saveStatus === 'saved' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)' } },
                      saveStatus === 'saved' ? t('fileSaved') : saveStatus === 'error' ? 'Error saving file.' : ''
                    ),
                    React.createElement(
                      'div',
                      { style: { display: 'flex', gap: '8px' } },
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn',
                          onClick: () => setPreviewFile(null)
                        },
                        'Close'
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn drw-btn-primary',
                          onClick: handleSaveFile,
                          disabled: saveStatus === 'saving'
                        },
                        saveStatus === 'saving' ? 'Saving...' : t('btnSaveFile')
                      )
                    )
                  )
                )
              )
            )
          : null
      )
    }

    function SettingsView(props) {
      const [activeTab, setActiveTab] = React.useState('profiles')
      const [healthData, setHealthData] = React.useState(null)
      const [autoSync, setAutoSync] = React.useState(false)

      const t = props.locale === 'ru' ? makeT(ru, en) : makeT(en, ru)
      const [profiles, setProfiles] = React.useState([])
      const [activeId, setActiveId] = React.useState(null)
      const [tunnels, setTunnels] = React.useState([])
      const [editing, setEditing] = React.useState(null)
      const [busy, setBusy] = React.useState(null)
      const [testResult, setTestResult] = React.useState(null)
      const [syncMsg, setSyncMsg] = React.useState(null)
      const [tunnelMsg, setTunnelMsg] = React.useState(null)
      const [showPassword, setShowPassword] = React.useState(false)

      // Tunnel creation inputs
      const [newTunnelLocal, setNewTunnelLocal] = React.useState('3000')
      const [newTunnelRemote, setNewTunnelRemote] = React.useState('3000')

      // Remote Directory Browser State
      const [browserOpen, setBrowserOpen] = React.useState(false)
      const [browserPath, setBrowserPath] = React.useState('/')
      const [browserEntries, setBrowserEntries] = React.useState([])
      const [browserLoading, setBrowserLoading] = React.useState(false)

      const loadState = async () => {
        try {
          const res = await fetch('/dsh-remote-workspace/state')
          if (res.ok) {
            const data = await res.json()
            if (data.ok) {
              setProfiles(data.profiles || [])
              setActiveId(data.activeId || null)
              setTunnels(data.tunnels || [])
              setAutoSync(Boolean(data.autoSync))
              if (data.activeId) {
                fetch(`/dsh-remote-workspace/health?profileId=${data.activeId}`).then(r => r.json()).then(h => { if (h.ok) setHealthData(h.health) }).catch(() => {})
              }
            }
          }
        } catch (_) {}
      }

      React.useEffect(() => {
        ensureCss()
        loadState()
      }, [])

      const handleSave = async (profile) => {
        setBusy('saving')
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
          })
          if (res.ok) {
            setEditing(null)
            setBrowserOpen(false)
            setTestResult(null)
            await loadState()
          }
        } catch (_) {}
        setBusy(null)
      }

      const handleDelete = async (id, name) => {
        if (!confirm(t('delConfirm', { name: name || id }))) return
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          })
          if (res.ok) {
            if (editing && editing.id === id) setEditing(null)
            await loadState()
          }
        } catch (_) {}
      }

      const handleSetActive = async (id) => {
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          })
          if (res.ok) {
            await loadState()
          }
        } catch (_) {}
      }

      const handleTest = async (prof) => {
        setBusy('testing')
        setTestResult(null)
        try {
          const res = await fetch('/dsh-remote-workspace/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: prof })
          })
          const data = await res.json()
          setTestResult(data)
        } catch (err) {
          setTestResult({ ok: false, error: err.message })
        }
        setBusy(null)
      }

      const openDirectoryBrowser = async (initialPath) => {
        setBrowserOpen(true)
        const target = initialPath && initialPath.startsWith('/') ? initialPath : '/'
        await fetchRemoteDir(target)
      }

      const fetchRemoteDir = async (dirPath) => {
        setBrowserLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: editing, remotePath: dirPath })
          })
          const data = await res.json()
          if (data.ok) {
            setBrowserPath(data.currentPath || dirPath)
            setBrowserEntries(data.entries || [])
          }
        } catch (_) {}
        setBrowserLoading(false)
      }

      const handleSync = async (direction) => {
        setBusy(`sync_${direction}`)
        setSyncMsg(null)
        try {
          const res = await fetch('/dsh-remote-workspace/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction })
          })
          const data = await res.json()
          if (data.ok) {
            const count = (direction === 'push' ? data.pushed?.length : data.pulled?.length) || 0
            if (data.conflicts && data.conflicts.length > 0) {
              setSyncMsg({ ok: false, text: t('syncConflict', { count: data.conflicts.length }) })
            } else {
              setSyncMsg({ ok: true, text: t('syncOk', { count }) })
            }
          } else {
            setSyncMsg({ ok: false, text: t('syncErr', { err: data.error || 'Unknown error' }) })
          }
        } catch (err) {
          setSyncMsg({ ok: false, text: t('syncErr', { err: err.message }) })
        }
        setBusy(null)
      }

      const handleStartTunnel = async () => {
        if (!activeId) return
        setBusy('tunnel_open')
        setTunnelMsg(null)
        try {
          const res = await fetch('/dsh-remote-workspace/tunnels/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId: activeId,
              localPort: newTunnelLocal,
              remotePort: newTunnelRemote
            })
          })
          const data = await res.json()
          if (data.ok) {
            setTunnelMsg({ ok: true, text: t('tOpenOk', { localPort: newTunnelLocal, remotePort: newTunnelRemote }) })
            await loadState()
          } else {
            setTunnelMsg({ ok: false, text: t('tOpenErr', { err: data.error || 'Failed' }) })
          }
        } catch (err) {
          setTunnelMsg({ ok: false, text: t('tOpenErr', { err: err.message }) })
        }
        setBusy(null)
      }

      const handleStopTunnel = async (tunnelId) => {
        try {
          const res = await fetch('/dsh-remote-workspace/tunnels/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tunnelId })
          })
          if (res.ok) {
            await loadState()
          }
        } catch (_) {}
      }

      const activeProfile = profiles.find((p) => p.id === activeId)

      return React.createElement(
        'div',
        { className: 'drw-page' },

        // Header with Live Badges (ClineBot Style)
        React.createElement(
          'div',
          { className: 'drw-header' },
          React.createElement(
            'div',
            { className: 'drw-header-top' },
            React.createElement('div', { className: 'drw-page-title' }, '🌐 ' + t('title')),
            React.createElement(
              'div',
              { className: 'drw-header-badges' },
              activeProfile
                ? React.createElement('span', { className: 'drw-badge drw-badge-ok' }, t('badgeOnline', { name: activeProfile.name || activeProfile.host, latency: testResult?.latencyMs ?? 15 }))
                : React.createElement('span', { className: 'drw-badge drw-badge-warn' }, t('badgeOffline')),
              activeProfile
                ? React.createElement('span', { className: 'drw-badge' }, activeProfile.authType === 'password' ? t('badgePassword') : t('badgeKey'))
                : null,
              React.createElement('span', { className: `drw-badge ${tunnels.length > 0 ? 'drw-badge-ok' : ''}` }, t('badgeTunnels', { count: tunnels.length }))
            )
          ),
          React.createElement('div', { className: 'drw-page-sub' }, t('subtitle'))
        ),

        // Section 1: SSH Profiles Table & Management
        React.createElement(
          'div',
          { className: 'drw-card' },
          React.createElement(
            'div',
            { className: 'drw-card-title' },
            React.createElement('span', null, t('profilesTitle')),
            !editing
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-primary',
                    onClick: () => {
                      setEditing({
                        id: 'prof_' + Math.random().toString(36).substr(2, 9),
                        name: 'New Server',
                        host: '',
                        port: 22,
                        username: 'root',
                        authType: 'key',
                        privateKeyPath: '~/.ssh/id_rsa',
                        passphrase: '',
                        password: '',
                        remoteWorkspace: '',
                        localMirrorPath: ''
                      })
                      setTestResult(null)
                    }
                  },
                  t('addBtn')
                )
              : null
          ),
          React.createElement('div', { className: 'drw-card-desc' }, t('profilesDesc')),

          // Interactive Editing Form
          editing
            ? React.createElement(
                'div',
                {
                  style: {
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }
                },
                React.createElement(
                  'div',
                  { style: { fontWeight: 600, fontSize: '14px', color: 'var(--dsw-alias-label-primary)' } },
                  editing.name ? t('formTitleEdit') : t('formTitleNew')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-grid-2' },
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fName')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: editing.name || '',
                      onChange: (e) => setEditing({ ...editing, name: e.target.value })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fHost')),
                    React.createElement('input', {
                      className: 'drw-input',
                      placeholder: '192.168.1.100 or server.domain.com',
                      value: editing.host || '',
                      onChange: (e) => setEditing({ ...editing, host: e.target.value })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fPort')),
                    React.createElement('input', {
                      className: 'drw-input',
                      type: 'number',
                      value: editing.port || 22,
                      onChange: (e) => setEditing({ ...editing, port: parseInt(e.target.value, 10) || 22 })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fUser')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: editing.username || '',
                      onChange: (e) => setEditing({ ...editing, username: e.target.value })
                    })
                  )
                ),

                // Auth Method Segmented Switcher (Key vs Password)
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  React.createElement('span', { className: 'drw-label' }, t('fAuthType')),
                  React.createElement(
                    'div',
                    { className: 'drw-segmented' },
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: `drw-segmented-item ${editing.authType !== 'password' ? 'drw-segmented-item-active' : ''}`,
                        onClick: () => setEditing({ ...editing, authType: 'key' })
                      },
                      '🔑 ' + t('fAuthKey')
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: `drw-segmented-item ${editing.authType === 'password' ? 'drw-segmented-item-active' : ''}`,
                        onClick: () => setEditing({ ...editing, authType: 'password' })
                      },
                      '🔒 ' + t('fAuthPass')
                    )
                  )
                ),

                // Conditional Auth Inputs
                editing.authType === 'password'
                  ? React.createElement(
                      'div',
                      { className: 'drw-field' },
                      React.createElement('span', { className: 'drw-label' }, t('fPassword')),
                      React.createElement(
                        'div',
                        { style: { display: 'flex', gap: '8px' } },
                        React.createElement('input', {
                          className: 'drw-input',
                          type: showPassword ? 'text' : 'password',
                          placeholder: '••••••••••••',
                          value: editing.password || '',
                          onChange: (e) => setEditing({ ...editing, password: e.target.value })
                        }),
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            className: 'drw-btn',
                            style: { fontSize: '11px', whiteSpace: 'nowrap' },
                            onClick: () => setShowPassword((v) => !v)
                          },
                          showPassword ? 'Hide' : 'Show'
                        )
                      )
                    )
                  : React.createElement(
                      'div',
                      { className: 'drw-grid-2' },
                      React.createElement(
                        'div',
                        { className: 'drw-field' },
                        React.createElement('span', { className: 'drw-label' }, t('fKeyPath')),
                        React.createElement('input', {
                          className: 'drw-input',
                          placeholder: '~/.ssh/id_rsa or /home/user/.ssh/id_ed25519',
                          value: editing.privateKeyPath || '',
                          onChange: (e) => setEditing({ ...editing, privateKeyPath: e.target.value })
                        }),
                        React.createElement('span', { className: 'drw-hint' }, t('fKeyPathHint'))
                      ),
                      React.createElement(
                        'div',
                        { className: 'drw-field' },
                        React.createElement('span', { className: 'drw-label' }, t('fPassphrase')),
                        React.createElement('input', {
                          className: 'drw-input',
                          type: 'password',
                          placeholder: 'Optional passphrase',
                          value: editing.passphrase || '',
                          onChange: (e) => setEditing({ ...editing, passphrase: e.target.value })
                        })
                      )
                    ),

                // Workspace Paths (Remote Workspace & Local Mirror)
                React.createElement(
                  'div',
                  { className: 'drw-grid-2' },
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fRemotePath')),
                    React.createElement(
                      'div',
                      { style: { display: 'flex', gap: '8px' } },
                      React.createElement('input', {
                        className: 'drw-input',
                        placeholder: '/home/user/project',
                        value: editing.remoteWorkspace || '',
                        onChange: (e) => setEditing({ ...editing, remoteWorkspace: e.target.value })
                      }),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn',
                          style: { whiteSpace: 'nowrap', fontSize: '12px' },
                          disabled: !editing.host,
                          onClick: () => openDirectoryBrowser(editing.remoteWorkspace || '/')
                        },
                        t('btnBrowse')
                      )
                    ),
                    React.createElement('span', { className: 'drw-hint' }, t('fRemotePathHint'))
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fLocalMirror')),
                    React.createElement('input', {
                      className: 'drw-input',
                      placeholder: '~/.dsh/mirrors/my-project',
                      value: editing.localMirrorPath || '',
                      onChange: (e) => setEditing({ ...editing, localMirrorPath: e.target.value })
                    }),
                    React.createElement('span', { className: 'drw-hint' }, t('fLocalMirrorHint'))
                  )
                ),

                // Directory Browser Modal
                browserOpen
                  ? React.createElement(
                      'div',
                      { className: 'drw-browser-modal' },
                      React.createElement(
                        'div',
                        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        React.createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, `📂 ${browserPath}`),
                        React.createElement(
                          'div',
                          { style: { display: 'flex', gap: '6px' } },
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn drw-btn-primary',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => {
                                setEditing({ ...editing, remoteWorkspace: browserPath })
                                setBrowserOpen(false)
                              }
                            },
                            t('btnSelectThis')
                          ),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => setBrowserOpen(false)
                            },
                            '✕'
                          )
                        )
                      ),
                      React.createElement(
                        'div',
                        { className: 'drw-browser-list' },
                        browserLoading
                          ? React.createElement('div', { style: { padding: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, 'Loading directory entries...')
                          : React.createElement(
                              React.Fragment,
                              null,
                              browserPath !== '/'
                                ? React.createElement(
                                    'div',
                                    {
                                      className: 'drw-browser-item',
                                      onClick: () => {
                                        const parent = browserPath.substring(0, browserPath.lastIndexOf('/')) || '/'
                                        fetchRemoteDir(parent)
                                      }
                                    },
                                    '📁 .. (parent directory)'
                                  )
                                : null,
                              browserEntries
                                .filter((e) => e.isDirectory)
                                .map((e) =>
                                  React.createElement(
                                    'div',
                                    {
                                      key: e.filename,
                                      className: 'drw-browser-item',
                                      onClick: () => {
                                        const next = browserPath === '/' ? `/${e.filename}` : `${browserPath}/${e.filename}`
                                        fetchRemoteDir(next)
                                      }
                                    },
                                    `📁 ${e.filename}`
                                  )
                                )
                            )
                      )
                    )
                  : null,

                // Form Action Buttons
                React.createElement(
                  'div',
                  { className: 'drw-row', style: { justifyContent: 'flex-end', marginTop: '6px' } },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      disabled: !editing.host || !!busy,
                      onClick: () => handleTest(editing)
                    },
                    busy === 'testing' ? t('testing') : t('btnTest')
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      onClick: () => {
                        setEditing(null)
                        setBrowserOpen(false)
                        setTestResult(null)
                      }
                    },
                    t('btnCancel')
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn drw-btn-primary',
                      disabled: !editing.host || !!busy,
                      onClick: () => handleSave(editing)
                    },
                    busy === 'saving' ? t('saving') : t('btnSave')
                  )
                ),
                testResult
                  ? React.createElement(
                      'div',
                      {
                        className: 'drw-preview',
                        style: {
                          borderColor: testResult.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)'
                        }
                      },
                      testResult.ok
                        ? t('testOk', { latency: testResult.latencyMs ?? testResult.latency ?? 0, os: testResult.remoteOs || testResult.os || 'Linux' })
                        : t('testFail', { err: testResult.error || 'Connection timed out' })
                    )
                  : null
              )
            : null,

          // Profiles List Table
          profiles.length > 0
            ? React.createElement(
                'table',
                { className: 'drw-table' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, t('nameCol')),
                    React.createElement('th', null, t('hostCol')),
                    React.createElement('th', null, t('portCol')),
                    React.createElement('th', null, t('pathCol')),
                    React.createElement('th', { style: { textAlign: 'right' } }, t('actionsCol'))
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  profiles.map((p) => {
                    const isAct = p.id === activeId
                    return React.createElement(
                      'tr',
                      { key: p.id },
                      React.createElement(
                        'td',
                        null,
                        React.createElement('span', { style: { fontWeight: 600 } }, p.name || 'Server'),
                        React.createElement(
                          'span',
                          { className: 'drw-badge', style: { marginLeft: '8px' } },
                          p.authType === 'password' ? '🔒 pwd' : '🔑 key'
                        ),
                        isAct
                          ? React.createElement('span', { className: 'drw-badge drw-badge-ok', style: { marginLeft: '6px' } }, t('activeBadge'))
                          : null
                      ),
                      React.createElement('td', { style: { fontFamily: 'monospace' } }, `${p.username || 'root'}@${p.host}`),
                      React.createElement('td', { style: { fontFamily: 'monospace' } }, p.port || 22),
                      React.createElement('td', { style: { fontFamily: 'monospace', fontSize: '12px' } }, p.remoteWorkspace || '—'),
                      React.createElement(
                        'td',
                        { style: { textAlign: 'right' } },
                        React.createElement(
                          'div',
                          { style: { display: 'inline-flex', gap: '6px' } },
                          !isAct
                            ? React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  className: 'drw-btn',
                                  style: { fontSize: '11px', padding: '3px 8px' },
                                  onClick: () => handleSetActive(p.id)
                                },
                                t('pinBtn')
                              )
                            : null,
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => {
                                setEditing({ ...p })
                                setTestResult(null)
                              }
                            },
                            t('editBtn')
                          ),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn drw-btn-danger',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => handleDelete(p.id, p.name)
                            },
                            t('delBtn')
                          )
                        )
                      )
                    )
                  })
                )
              )
            : !editing
            ? React.createElement('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('noHosts'))
            : null
        ),

        // Section 2: Active Connection Diagnostics (ClineBot Card 4 style)
        activeProfile
          ? React.createElement(
              'div',
              { className: 'drw-card' },
              React.createElement(
                'div',
                { className: 'drw-card-title' },
                React.createElement('span', null, t('diagTitle')),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    style: { fontSize: '11px', padding: '3px 9px' },
                    disabled: busy === 'testing',
                    onClick: () => handleTest(activeProfile)
                  },
                  busy === 'testing' ? t('testing') : t('diagProbeBtn')
                )
              ),
              React.createElement('div', { className: 'drw-card-desc' }, t('diagDesc')),
              React.createElement(
                'div',
                { className: 'drw-grid-4' },
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.name || activeProfile.host),
                  React.createElement('div', { className: 'drw-stat-lbl' }, `SSH: ${activeProfile.username}@${activeProfile.host}:${activeProfile.port || 22}`)
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.remoteWorkspace || '—'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'Remote Workspace')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.localMirrorPath || '—'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'Local Mirror Path')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val', style: { color: 'var(--dsw-alias-state-success-primary)' } }, 'Ready ✓'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, activeProfile.authType === 'password' ? 'Password Auth' : 'SSH Key Auth')
                )
              )
            )
          : null,

        // Section 3: Mirror Sync (ClineBot Action Card style)
        activeProfile
          ? React.createElement(
              'div',
              { className: 'drw-card' },
              React.createElement('div', { className: 'drw-card-title' }, t('syncTitle')),
              React.createElement('div', { className: 'drw-card-desc' }, t('syncDesc')),

              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2)', marginBottom: '12px' } },
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                  React.createElement('span', { style: { fontWeight: 600, fontSize: '13px' } }, t('autoSyncTitle')),
                  React.createElement('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('autoSyncDesc'))
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: `drw-btn ${autoSync ? 'drw-btn-primary' : ''}`,
                    style: { padding: '4px 12px', fontSize: '12px' },
                    onClick: async () => {
                      const next = !autoSync
                      try {
                        const res = await fetch('/dsh-remote-workspace/watcher/toggle', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: next })
                        })
                        const d = await res.json()
                        if (d.ok) setAutoSync(d.autoSync)
                      } catch (_) {}
                    }
                  },
                  autoSync ? '⚡ Active (ON)' : '⚪ Off'
                )
              ),

              React.createElement(
                'div',
                { className: 'drw-row' },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    disabled: !!busy || !activeProfile.remoteWorkspace || !activeProfile.localMirrorPath,
                    onClick: () => handleSync('pull')
                  },
                  busy === 'sync_pull' ? t('pulling') : t('pullBtn')
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    disabled: !!busy || !activeProfile.remoteWorkspace || !activeProfile.localMirrorPath,
                    onClick: () => handleSync('push')
                  },
                  busy === 'sync_push' ? t('pushing') : t('pushBtn')
                )
              ),
              syncMsg
                ? React.createElement(
                    'div',
                    {
                      className: 'drw-preview',
                      style: {
                        borderColor: syncMsg.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)'
                      }
                    },
                    syncMsg.text
                  )
                : null
            )
          : null,

        // Section 4: SSH Port Forwarding (Tunnels Manager)
        React.createElement(
          'div',
          { className: 'drw-card' },
          React.createElement('div', { className: 'drw-card-title' }, t('tunnelsTitle')),
          React.createElement('div', { className: 'drw-card-desc' }, t('tunnelsDesc')),

          // Start tunnel inline row
          activeProfile
            ? React.createElement(
                'div',
                { className: 'drw-row', style: { alignItems: 'flex-end', background: 'var(--dsw-alias-bg-layer-2)', padding: '10px 12px', borderRadius: '8px' } },
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                  React.createElement('span', { className: 'drw-label' }, t('tLocalPort')),
                  React.createElement('input', {
                    className: 'drw-input',
                    style: { width: '120px' },
                    type: 'number',
                    value: newTunnelLocal,
                    onChange: (e) => setNewTunnelLocal(e.target.value)
                  })
                ),
                React.createElement('span', { style: { paddingBottom: '8px', color: 'var(--dsw-alias-label-secondary)' } }, '→'),
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                  React.createElement('span', { className: 'drw-label' }, t('tRemotePort')),
                  React.createElement('input', {
                    className: 'drw-input',
                    style: { width: '120px' },
                    type: 'number',
                    value: newTunnelRemote,
                    onChange: (e) => setNewTunnelRemote(e.target.value)
                  })
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-primary',
                    disabled: busy === 'tunnel_open',
                    onClick: handleStartTunnel
                  },
                  busy === 'tunnel_open' ? t('tOpening') : t('tOpenBtn')
                )
              )
            : null,

          tunnelMsg
            ? React.createElement(
                'div',
                {
                  className: 'drw-preview',
                  style: {
                    borderColor: tunnelMsg.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)'
                  }
                },
                tunnelMsg.text
              )
            : null,

          // Tunnels Table
          tunnels.length > 0
            ? React.createElement(
                'table',
                { className: 'drw-table' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, t('tunnelsColId')),
                    React.createElement('th', null, t('tunnelsColRoute')),
                    React.createElement('th', { style: { textAlign: 'right' } }, t('tunnelsColActions'))
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  tunnels.map((tun) =>
                    React.createElement(
                      'tr',
                      { key: tun.id },
                      React.createElement('td', { style: { fontFamily: 'monospace', fontSize: '12px' } }, tun.id),
                      React.createElement(
                        'td',
                        null,
                        React.createElement('span', { className: 'drw-badge drw-badge-ok' }, `127.0.0.1:${tun.localPort}`),
                        ' → ',
                        React.createElement('span', { className: 'drw-badge' }, `${tun.targetHost || '127.0.0.1'}:${tun.remotePort}`)
                      ),
                      React.createElement(
                        'td',
                        { style: { textAlign: 'right' } },
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            className: 'drw-btn drw-btn-danger',
                            style: { fontSize: '11px', padding: '3px 8px' },
                            onClick: () => handleStopTunnel(tun.id)
                          },
                          t('tStopBtn')
                        )
                      )
                    )
                  )
                )
              )
            : React.createElement('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('tNoTunnels'))
        )
      )
    }

    // Accordion item for Settings -> Plugins section
    function PluginCard(props) {
      const [open, setOpen] = React.useState(false)
      const t = props.locale === 'ru' ? makeT(ru, en) : makeT(en, ru)

      React.useEffect(() => {
        ensureCss()
      }, [])

      return React.createElement(
        'li',
        { className: 'drw-card', style: { listStyle: 'none', marginBottom: '12px' } },
        React.createElement(
          'button',
          {
            type: 'button',
            style: {
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: 0,
              textAlign: 'left',
            },
            'aria-expanded': open,
            onClick: () => setOpen((v) => !v),
          },
          React.createElement('span', { style: { fontSize: '20px', marginRight: '12px' } }, '🌐'),
          React.createElement(
            'div',
            { style: { flex: 1 } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '15px', color: 'var(--dsw-alias-label-primary)' } }, t('title')),
            React.createElement('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('subtitle'))
          ),
          React.createElement('span', { className: 'drw-badge drw-badge-ok', style: { marginRight: '14px' } }, t('status')),
          React.createElement(
            'span',
            { style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .16s' } },
            React.createElement(FallbackChevron)
          )
        ),
        open
          ? React.createElement(
              'div',
              { style: { marginTop: '16px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '16px' } },
              React.createElement(SettingsView, props)
            )
          : null
      )
    }

    function RemoteWorkspaceChip(props) {
      ensureCss()
      const [activeHost, setActiveHost] = React.useState(null)

      React.useEffect(() => {
        fetch('/dsh-remote-workspace/state')
          .then((r) => r.json())
          .then((d) => {
            if (d.ok && d.activeId && d.profiles) {
              const f = d.profiles.find((p) => p.id === d.activeId)
              if (f) setActiveHost(f.name || f.host)
            }
          })
          .catch(() => {})
      }, [])

      return React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            borderRadius: '999px',
            border: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-layer-1)',
            color: activeHost ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)',
            cursor: 'pointer'
          }
        },
        React.createElement('span', null, '🌐'),
        React.createElement('span', null, activeHost ? `SSH: ${activeHost}` : 'SSH: Local')
      )
    }

    function apply(ctx) {
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        try { ctx.locale.register(NS, { en, ru }) } catch (_) {}
      }

      if (ctx.slots && typeof ctx.slots.inject === 'function') {
        ctx.slots.inject('settings.plugin.item', () =>
          ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              locale: NS,
              inject: () => ({ ctx })
            },
            (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx }))
          )
        )

        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.utilities',
              id: '@goodandready/dsh-remote-workspace',
              order: 30
            },
            (props) => React.createElement(RemoteWorkspaceChip, props)
          )
        )
      }
    }

    module.exports = { apply, inject: ['slots', 'locale'] }
    return module.exports
  }
})
