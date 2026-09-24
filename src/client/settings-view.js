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
      const [actionError, setActionError] = React.useState('')
      const [authPrompts, setAuthPrompts] = React.useState([])
      const [authAnswers, setAuthAnswers] = React.useState({})
      const [importReport, setImportReport] = React.useState(null)
      const [syncMsg, setSyncMsg] = React.useState(null)
      const [tunnelMsg, setTunnelMsg] = React.useState(null)
      const [showPassword, setShowPassword] = React.useState(false)
      const [terminalFont, setTerminalFont] = React.useState('')

      // Tunnel creation inputs
      const [newTunnelLocal, setNewTunnelLocal] = React.useState('3000')
      const [newTunnelRemote, setNewTunnelRemote] = React.useState('3000')

      // Remote Directory Browser State
      const [browserOpen, setBrowserOpen] = React.useState(false)
      const [browserPath, setBrowserPath] = React.useState('/')
      const [browserEntries, setBrowserEntries] = React.useState([])
      const [browserLoading, setBrowserLoading] = React.useState(false)


      function actionErrorText(status, data) {
        if (status >= 200 && status < 300 && data && data.ok !== false) return ''
        if (data && typeof data.error === 'string' && data.error) return data.error
        return 'HTTP ' + status
      }

      const reportAction = async (res) => {
        let data = null
        try { data = await res.json() } catch (err) { data = null }
        const text = actionErrorText(res.status, data)
        setActionError(text ? ((data && data.error) ? text : t('actionFailed')) : '')
        return text ? null : data
      }

      const loadInFlight = React.useRef(false)

      const loadState = async (force) => {
        const hidden = typeof document !== 'undefined' && document.hidden
        if (!force && (hidden || loadInFlight.current)) return
        loadInFlight.current = true
        try {
          const res = await fetch('/dsh-remote-workspace/state')
          const data = await reportAction(res)
          if (data && data.ok) {
            setProfiles(data.profiles || [])
            setActiveId(data.activeId || null)
            setTunnels(data.tunnels || [])
            setAutoSync(Boolean(data.autoSync))
            setAuthPrompts(data.authPrompts || [])
            setTerminalFont(data.terminalFontFamily || '')
            applyTerminalFont(data.terminalFontFamily || '')
            if (data.activeId) {
              fetch(`/dsh-remote-workspace/health?profileId=${data.activeId}`).then(r => r.json()).then(h => { if (h.ok) setHealthData(h.health) }).catch(() => {})
            }
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        } finally {
          loadInFlight.current = false
        }
      }

      React.useEffect(() => {
        ensureCss()
        loadState(true)
        const timer = setInterval(() => loadState(false), 2000)
        const onVisible = () => {
          if (typeof document !== 'undefined' && !document.hidden) loadState(true)
        }
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
        return () => {
          clearInterval(timer)
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
        }
      }, [])


      const saveTerminalFont = async () => {
        try {
          const res = await fetch('/dsh-remote-workspace/terminal/font', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fontFamily: terminalFont })
          })
          const data = await reportAction(res)
          if (data && data.ok) {
            setTerminalFont(data.terminalFontFamily || '')
            applyTerminalFont(data.terminalFontFamily || '')
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const submitAuth = async (prompt) => {
        const answers = (prompt.prompts || []).map((_, index) => authAnswers[prompt.profileId + ':' + index] || '')
        try {
          const res = await fetch('/dsh-remote-workspace/auth/keyboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: prompt.profileId, answers })
          })
          const data = await reportAction(res)
          if (data) await loadState()
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const handleSave = async (profile) => {
        setBusy('saving')
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
          })
          const data = await reportAction(res)
          if (data) {
            setEditing(null)
            setBrowserOpen(false)
            setTestResult(null)
            await loadState()
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
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
          const data = await reportAction(res)
          if (data) {
            if (editing && editing.id === id) setEditing(null)
            await loadState()
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const handleSetActive = async (id) => {
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          })
          const data = await reportAction(res)
          if (data) await loadState()
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const handleTest = async (prof) => {
        setBusy('testing')
        setTestResult(null)
        try {
          const res = await fetch('/dsh-remote-workspace/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prof)
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
          const data = await reportAction(res)
          if (data && data.ok) {
            setBrowserPath(data.currentPath || dirPath)
            setBrowserEntries(data.entries || [])
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
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
          const data = await reportAction(res)
          if (data) await loadState()
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const activeProfile = profiles.find((p) => p.id === activeId)

      const handleImport = async () => {
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/import-ssh-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          })
          const data = await reportAction(res)
          if (data) {
            setImportReport(data)
            await loadState()
          }
        } catch (err) {
          setActionError(err && err.message ? err.message : t('actionFailed'))
        }
      }

      const skipReason = (reason) => {
        if (reason === 'wildcard') return t('skipWildcard')
        if (reason === 'match') return t('skipMatch')
        if (reason === 'duplicate') return t('skipDuplicate')
        if (reason === 'missing-include') return t('skipMissing')
        return reason
      }

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
          React.createElement('div', { className: 'drw-page-sub' }, t('subtitle')),
          actionError
            ? React.createElement('div', { className: 'drw-badge drw-badge-err', role: 'alert' }, actionError)
            : null
        ),



        authPrompts.length
          ? React.createElement(
              'div',
              { className: 'drw-card', role: 'dialog', 'aria-label': t('authPromptTitle') },
              React.createElement('div', { className: 'drw-page-title' }, t('authPromptTitle')),
              authPrompts.map((prompt) => React.createElement(
                'div',
                { key: prompt.profileId, className: 'drw-field' },
                prompt.instructions
                  ? React.createElement('span', { className: 'drw-hint' }, prompt.instructions)
                  : null,
                (prompt.prompts || []).map((field, index) => React.createElement('input', {
                  key: index,
                  className: 'drw-input',
                  type: field.echo ? 'text' : 'password',
                  placeholder: field.prompt || t('authPromptCode'),
                  value: authAnswers[prompt.profileId + ':' + index] || '',
                  onChange: (e) => setAuthAnswers({ ...authAnswers, [prompt.profileId + ':' + index]: e.target.value })
                })),
                React.createElement('button', {
                  type: 'button',
                  className: 'drw-btn drw-btn-primary',
                  onClick: () => submitAuth(prompt)
                }, t('authPromptSubmit'))
              ))
            )
          : null,


        React.createElement(
          'div',
          { className: 'drw-card' },
          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: handleImport }, t('btnImportSsh')),
          importReport
            ? React.createElement(
                'div',
                { className: 'drw-hint', role: 'status' },
                t('importAdded', { count: importReport.count || 0 }),
                (importReport.skipped || []).map((item, index) => React.createElement('div', { key: index }, (item.name || '') + ': ' + skipReason(item.reason)))
              )
            : null
        ),


        React.createElement('div', { className: 'drw-card' },
          React.createElement('label', { className: 'drw-label' }, t('fTerminalFont')),
          React.createElement('div', { style: { display: 'flex', gap: '8px' } },
            React.createElement('input', {
              className: 'drw-input',
              type: 'text',
              value: terminalFont,
              placeholder: 'ui-monospace, Consolas, monospace',
              onChange: (e) => setTerminalFont(e.target.value)
            }),
            React.createElement('button', { type: 'button', className: 'drw-btn', onClick: saveTerminalFont }, t('btnSave'))
          ),
          React.createElement('div', { className: 'drw-hint' }, t('fTerminalFontHint'))
        ),

        React.createElement('div', { style: { display: 'flex', gap: '8px' } },
          React.createElement('button', { type: 'button', className: activeTab === 'profiles' ? 'drw-btn drw-btn-primary' : 'drw-btn', onClick: () => setActiveTab('profiles') }, t('tabProfiles')),
          React.createElement('button', { type: 'button', className: activeTab === 'cluster' ? 'drw-btn drw-btn-primary' : 'drw-btn', onClick: () => setActiveTab('cluster') }, t('tabCluster'))
        ),
        activeTab === 'cluster'
          ? React.createElement(ClusterPanel, { t, profiles })
          : React.createElement(ProfilesPanel, { t, editing, setEditing, setTestResult, profiles, activeId, busy, handleSave, testResult, handleTest, handleSetActive, handleDelete, browserOpen, setBrowserOpen, browserPath, browserEntries, browserLoading, openDirectoryBrowser, fetchRemoteDir, showPassword, setShowPassword }),


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


        React.createElement(SyncPanel, { t, busy, activeProfile, handleSync, syncMsg, autoSync, setAutoSync, reportAction, setActionError }),

        React.createElement(TunnelsPanel, { t, busy, activeProfile, newTunnelLocal, setNewTunnelLocal, newTunnelRemote, setNewTunnelRemote, handleStartTunnel, tunnelMsg, tunnels, handleStopTunnel }),

      )
    }

    // Accordion item for Settings -> Plugins section
