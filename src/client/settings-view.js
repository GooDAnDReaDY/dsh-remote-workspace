    function SettingsView(props) {
      const [activeTab, setActiveTab] = React.useState('profiles')
      const [healthData, setHealthData] = React.useState(null)
      const [autoSync, setAutoSync] = React.useState(false)

      const t = props.t || (props.locale === 'zh' ? makeT(zh, en) : makeT(en, zh))
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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
                      } catch (err) { /* best-effort cleanup */ }
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
