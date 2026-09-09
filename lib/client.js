window.__ModuleLoader__.load({
  id: '@goodandready/dsh-remote-workspace',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const NS = 'dsh-remote-workspace'

    function ensureCss() {
      if (typeof document === 'undefined') return
      if (document.getElementById('drw-clinebot-style')) return
      const style = document.createElement('style')
      style.id = 'drw-clinebot-style'
      style.dataset.dshPlugin = NS
      style.textContent = `
.drw-page{display:flex;flex-direction:column;gap:18px;padding:6px 0 20px;max-width:960px}
.drw-header{display:flex;flex-direction:column;gap:6px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.drw-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px}
.drw-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.4}

.drw-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;list-style:none}
.drw-card-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between}
.drw-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-4px;line-height:1.4}

.drw-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.drw-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px}

.drw-badge{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500;font-family:monospace}
.drw-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}
.drw-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}
.drw-badge-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}

.drw-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;width:100%;box-sizing:border-box}
.drw-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}
.drw-label{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-bottom:2px}
.drw-field{display:flex;flex-direction:column;gap:3px;flex:1;min-width:180px}

.drw-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.drw-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}
.drw-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.drw-btn-primary:hover:not(:disabled){opacity:0.9}
.drw-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:rgba(239,68,68,0.3)}
.drw-btn-danger:hover:not(:disabled){background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.5)}

.drw-table{width:100%;border-collapse:collapse;margin-top:6px}
.drw-table th{text-align:left;font-size:12px;color:var(--dsw-alias-label-secondary);padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);font-weight:600}
.drw-table td{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:13px;color:var(--dsw-alias-label-primary)}
.drw-table tr:hover{background:var(--dsw-alias-bg-layer-2)}

.drw-stat-box{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:3px}
.drw-stat-val{font-size:16px;font-weight:700;color:var(--dsw-alias-label-primary)}
.drw-stat-lbl{font-size:11px;color:var(--dsw-alias-label-secondary)}
.drw-preview{padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;border:1px solid var(--dsw-alias-border-l2)}
      `
      document.head.appendChild(style)
    }

    const en = {
      title: 'Remote Workspace',
      subtitle: 'Manage SSH connections, SFTP sync, and tunnels',
      status: 'Ready',
      activeBadge: 'Active',
      setActiveBtn: 'Set Active',
      pinned: 'Pinned Active Host',
      profilesTitle: '🖥️ Remote SSH Profiles',
      profilesDesc: 'Configure remote hosts for code execution, SFTP file access, and mirror syncing.',
      addBtn: '+ Add Host',
      nameCol: 'Name',
      hostCol: 'Host / User',
      portCol: 'Port',
      pathCol: 'Remote Path',
      actionsCol: 'Actions',
      noHosts: 'No remote hosts configured yet. Click "+ Add Host" to create one.',
      formTitleNew: 'Add New Host Profile',
      formTitleEdit: 'Edit Host Profile',
      fName: 'Profile Name',
      fHost: 'Host / IP Address',
      fPort: 'Port',
      fUser: 'Username',
      fAuthType: 'Auth Method',
      fAuthKey: 'Private Key Path',
      fAuthPass: 'Password',
      fKeyPath: 'Key Path (e.g. ~/.ssh/id_rsa)',
      fRemotePath: 'Remote Project Directory',
      fLocalMirror: 'Local Mirror Directory',
      btnTest: '⚡ Test Connection',
      btnSave: 'Save Profile',
      btnCancel: 'Cancel',
      btnDelete: 'Delete',
      testing: 'Testing Connection...',
      saving: 'Saving...',
      diagTitle: '📊 Active Connection Diagnostics',
      diagDesc: 'Live connection probe to the currently selected remote machine.',
      syncTitle: '🔄 Mirror Sync & Port Tunnels',
      syncDesc: 'Synchronize local workspace mirror or check forwarded background port tunnels.',
      pullBtn: '⬇️ Pull from Remote',
      pushBtn: '⬆️ Push to Remote',
      syncSuccess: 'Sync completed successfully',
      syncFailed: 'Sync encountered conflicts or errors: '
    }

    const ru = {
      title: 'Удалённое рабочее пространство',
      subtitle: 'Управление подключениями по SSH, синхронизацией SFTP и туннелями',
      status: 'Готово',
      activeBadge: 'Активен',
      setActiveBtn: 'Сделать активным',
      pinned: 'Активный хост',
      profilesTitle: '🖥️ Профили SSH серверов',
      profilesDesc: 'Настройка удалённых хостов для выполнения команд, SFTP доступа и синхронизации.',
      addBtn: '+ Добавить хост',
      nameCol: 'Имя',
      hostCol: 'Хост / Пользователь',
      portCol: 'Порт',
      pathCol: 'Удалённый путь',
      actionsCol: 'Действия',
      noHosts: 'Удалённые хосты ещё не настроены. Нажмите «+ Добавить хост».',
      formTitleNew: 'Добавление нового SSH хоста',
      formTitleEdit: 'Редактирование профиля хоста',
      fName: 'Название подключения',
      fHost: 'Хост / IP-адрес',
      fPort: 'Порт',
      fUser: 'Имя пользователя',
      fAuthType: 'Способ авторизации',
      fAuthKey: 'Путь к SSH-ключу',
      fAuthPass: 'Пароль',
      fKeyPath: 'Путь к ключу (например, ~/.ssh/id_rsa)',
      fRemotePath: 'Удалённая папка проекта',
      fLocalMirror: 'Локальная папка зеркала',
      btnTest: '⚡ Проверить связь (Ping)',
      btnSave: 'Сохранить профиль',
      btnCancel: 'Отмена',
      btnDelete: 'Удалить',
      testing: 'Проверка соединения…',
      saving: 'Сохранение…',
      diagTitle: '📊 Диагностика активного подключения',
      diagDesc: 'Проверка доступности и измерение задержки активного сервера.',
      syncTitle: '🔄 Синхронизация зеркала и туннели',
      syncDesc: 'Ручная синхронизация файлов с удалённым сервером и статус проброса портов.',
      pullBtn: '⬇️ Скачать с сервера (Pull)',
      pushBtn: '⬆️ Загрузить на сервер (Push)',
      syncSuccess: 'Синхронизация успешно выполнена',
      syncFailed: 'Ошибка синхронизации: '
    }

    function makeT(dict, fallback) {
      return function t(key) {
        return (dict && dict[key]) || (fallback && fallback[key]) || key
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

    function SettingsView(props) {
      const t = props.locale === 'ru' ? makeT(ru, en) : makeT(en, ru)
      const [profiles, setProfiles] = React.useState([])
      const [activeId, setActiveId] = React.useState(null)
      const [editing, setEditing] = React.useState(null) // null or object
      const [busy, setBusy] = React.useState(null)
      const [testResult, setTestResult] = React.useState(null)
      const [syncMsg, setSyncMsg] = React.useState(null)

      const loadState = async () => {
        try {
          const res = await fetch('/dsh-remote-workspace/state')
          if (res.ok) {
            const data = await res.json()
            if (data.ok) {
              setProfiles(data.profiles || [])
              setActiveId(data.activeId || null)
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
            await loadState()
          }
        } catch (_) {}
        setBusy(null)
      }

      const handleDelete = async (id) => {
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

      const handleSync = async (direction) => {
        setBusy(`sync_${direction}`)
        setSyncMsg(null)
        try {
          const res = await fetch('/dsh-remote-workspace/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeId, direction })
          })
          const data = await res.json()
          if (data.ok) {
            setSyncMsg({ ok: true, text: t('syncSuccess') })
          } else {
            setSyncMsg({ ok: false, text: t('syncFailed') + (data.error || 'Conflicts detected') })
          }
        } catch (err) {
          setSyncMsg({ ok: false, text: err.message })
        }
        setBusy(null)
      }

      const activeProfile = profiles.find((p) => p.id === activeId)

      return React.createElement(
        'div',
        { className: 'drw-page' },

        // Section 1: Profiles Management (ClineBot style)
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
                    onClick: () =>
                      setEditing({
                        id: 'prof_' + Math.random().toString(36).substr(2, 9),
                        name: 'New Server',
                        host: '',
                        port: 22,
                        username: 'root',
                        authType: 'key',
                        privateKeyPath: '~/.ssh/id_rsa',
                        remoteWorkspace: '',
                        localMirrorPath: ''
                      })
                  },
                  t('addBtn')
                )
              : null
          ),
          React.createElement('div', { className: 'drw-card-desc' }, t('profilesDesc')),

          // Editing Form
          editing
            ? React.createElement(
                'div',
                {
                  style: {
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }
                },
                React.createElement('div', { style: { fontWeight: 600, fontSize: '14px' } }, editing.name ? t('formTitleEdit') : t('formTitleNew')),
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
                      placeholder: '192.168.1.100 or domain.com',
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
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fKeyPath')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: editing.privateKeyPath || '',
                      onChange: (e) => setEditing({ ...editing, privateKeyPath: e.target.value })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fRemotePath')),
                    React.createElement('input', {
                      className: 'drw-input',
                      placeholder: '/var/www/my-project',
                      value: editing.remoteWorkspace || '',
                      onChange: (e) => setEditing({ ...editing, remoteWorkspace: e.target.value })
                    })
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'drw-row', style: { justifyContent: 'flex-end', marginTop: '6px' } },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      disabled: !!busy,
                      onClick: () => handleTest(editing)
                    },
                    busy === 'testing' ? t('testing') : t('btnTest')
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      onClick: () => setEditing(null)
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
                        ? `✅ Connection OK! Latency: ${testResult.latencyMs} ms | OS: ${testResult.remoteOs || 'Unknown'}`
                        : `❌ Connection Failed: ${testResult.error || 'Connection timed out'}`
                    )
                  : null
              )
            : null,

          // Profiles Table
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
                        React.createElement('span', { style: { fontWeight: 600 } }, p.name),
                        isAct
                          ? React.createElement('span', { className: 'drw-badge drw-badge-ok', style: { marginLeft: '8px' } }, t('activeBadge'))
                          : null
                      ),
                      React.createElement('td', null, `${p.username}@${p.host}`),
                      React.createElement('td', null, p.port || 22),
                      React.createElement('td', null, p.remoteWorkspace || '—'),
                      React.createElement(
                        'td',
                        { style: { textAlign: 'right' } },
                        React.createElement(
                          'div',
                          { className: 'drw-row', style: { justifyContent: 'flex-end' } },
                          !isAct
                            ? React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  className: 'drw-btn',
                                  style: { fontSize: '11px', padding: '3px 8px' },
                                  onClick: () => handleSetActive(p.id)
                                },
                                t('setActiveBtn')
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
                            '✏️'
                          ),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn drw-btn-danger',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => handleDelete(p.id)
                            },
                            '🗑️'
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
              React.createElement('div', { className: 'drw-card-title' }, t('diagTitle')),
              React.createElement('div', { className: 'drw-card-desc' }, t('diagDesc')),
              React.createElement(
                'div',
                { className: 'drw-grid-2' },
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.name),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'Host: ' + activeProfile.host)
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.remoteWorkspace || '/'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'Remote Workspace Directory')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, activeProfile.authType === 'key' ? 'SSH Key' : 'Password'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'User: ' + activeProfile.username)
                ),
                React.createElement(
                  'div',
                  { className: 'drw-stat-box' },
                  React.createElement('div', { className: 'drw-stat-val' }, 'Ready'),
                  React.createElement('div', { className: 'drw-stat-lbl' }, 'DSH Remote Engine Status')
                )
              )
            )
          : null,

        // Section 3: Mirror Sync (ClineBot Action Card style)
        activeProfile && activeProfile.remoteWorkspace
          ? React.createElement(
              'div',
              { className: 'drw-card' },
              React.createElement('div', { className: 'drw-card-title' }, t('syncTitle')),
              React.createElement('div', { className: 'drw-card-desc' }, t('syncDesc')),
              React.createElement(
                'div',
                { className: 'drw-row' },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    disabled: !!busy,
                    onClick: () => handleSync('pull')
                  },
                  busy === 'sync_pull' ? 'Pulling...' : t('pullBtn')
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    disabled: !!busy,
                    onClick: () => handleSync('push')
                  },
                  busy === 'sync_push' ? 'Pushing...' : t('pushBtn')
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
          : null
      )
    }

    // Accordion item for Plugins section (same pattern as dsh-clinebot)
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
          ? React.createElement('div', { style: { marginTop: '16px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '16px' } },
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

    module.exports = { apply, inject: ['slots', 'locale', 'settingsScope'] }
    return module.exports
  }
})
