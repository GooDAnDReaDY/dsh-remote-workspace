    const DRW_ACTIVE = 'data-drw-active'
    const DRW_VIEW = 'data-drw-view'
    const DRW_ENTRY = 'data-drw-entry'
    const DRW_PANEL = 'remote-workspace'
    const DRW_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></svg>'

    function workspaceTranslator(ctx) {
      let lang = ''
      try {
        lang = ctx && ctx.locale && typeof ctx.locale.getLocale === 'function' ? ctx.locale.getLocale() : ''
      } catch (err) { lang = '' }
      if (typeof lang === 'string' && (lang === 'zh' || lang.indexOf('zh') === 0)) return makeT(zh, en)
      return makeT(en, zh)
    }

    function WorkspaceScreen(props) {
      const t = workspaceTranslator(props.ctx)
      const [tab, setTab] = React.useState('hosts')
      const [profiles, setProfiles] = React.useState([])
      const [activeId, setActiveId] = React.useState('')
      const [tunnels, setTunnels] = React.useState([])
      const [localPort, setLocalPort] = React.useState('3000')
      const [remotePort, setRemotePort] = React.useState('3000')
      const [tunnelMsg, setTunnelMsg] = React.useState(null)
      const [busy, setBusy] = React.useState(null)
      const activeProfile = profiles.find((item) => item.id === activeId) || null

      const loadState = async () => {
        try {
          const res = await fetch('/dsh-remote-workspace/state')
          const data = await res.json()
          if (data && data.ok) {
            setProfiles(data.profiles || [])
            setActiveId(data.activeId || '')
            setTunnels(data.tunnels || [])
          }
        } catch (err) { /* state refresh is best effort */ }
      }

      React.useEffect(() => {
        ensureCss()
        loadState()
      }, [])

      const startTunnel = async () => {
        if (!activeId) return
        setBusy('tunnel_open')
        try {
          const res = await fetch('/dsh-remote-workspace/tunnels/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeId, localPort, remotePort })
          })
          const data = await res.json()
          setTunnelMsg(data && data.ok
            ? { ok: true, text: t('tOpenOk', { localPort, remotePort }) }
            : { ok: false, text: t('tOpenErr', { err: (data && data.error) || 'Failed' }) })
          if (data && data.ok) await loadState()
        } catch (err) {
          setTunnelMsg({ ok: false, text: t('tOpenErr', { err: err.message }) })
        }
        setBusy(null)
      }

      const stopTunnel = async (tunnelId) => {
        setBusy('tunnel_stop')
        try {
          await fetch('/dsh-remote-workspace/tunnels/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tunnelId })
          })
          await loadState()
        } catch (err) { /* stop is reported by the next state load */ }
        setBusy(null)
      }

      const tabs = [
        ['hosts', 'wsHosts'],
        ['terminal', 'wsTerminal'],
        ['files', 'wsFiles'],
        ['docker', 'wsDocker'],
        ['tunnels', 'wsTunnels'],
        ['cluster', 'wsCluster']
      ]

      return React.createElement('div', { className: 'drw-ws' },
        React.createElement('div', { className: 'drw-ws-bar' },
          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: () => props.onClose && props.onClose() }, t('wsBack')),
          tabs.map(([id, key]) => React.createElement('button', {
            key: id,
            type: 'button',
            className: tab === id ? 'drw-btn drw-btn-primary' : 'drw-btn',
            onClick: () => setTab(id)
          }, t(key)))
        ),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'hosts' }, React.createElement(SettingsView, props)),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'terminal' }, React.createElement(TerminalTab, { t, activeProfile })),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'files' }, React.createElement(ExplorerTab, { t, activeProfile })),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'docker' }, React.createElement(ContainersTab, { t, activeProfile })),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'tunnels' }, React.createElement(TunnelsPanel, {
          t, busy, activeProfile, tunnelMsg, tunnels,
          newTunnelLocal: localPort, setNewTunnelLocal: setLocalPort,
          newTunnelRemote: remotePort, setNewTunnelRemote: setRemotePort,
          handleStartTunnel: startTunnel, handleStopTunnel: stopTunnel
        })),
        React.createElement('div', { className: 'drw-ws-panel', hidden: tab !== 'cluster' }, React.createElement(ClusterPanel, { t, profiles }))
      )
    }

    function createWorkspaceToggle() {
      let open = false
      const listeners = new Set()
      return {
        isOpen() { return open },
        set(next) {
          open = Boolean(next)
          listeners.forEach((fn) => fn(open))
        },
        toggle() { this.set(!open) },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
      }
    }

    function nativeSidebarButton() {
      const nodes = document.querySelectorAll('button[class*="newSession"]')
      for (const node of nodes) {
        if (String(node.className).indexOf('newSessionLabel') === -1) return node
      }
      return null
    }

    function mountRemoteWorkspace(ctx) {
      if (typeof document === 'undefined') return function () {}
      ensureCss()
      const toggle = createWorkspaceToggle()
      const t = workspaceTranslator(ctx)
      let entry = null
      let container = null
      let root = null

      const placeEntry = () => {
        if (entry && entry.isConnected) return
        const target = nativeSidebarButton()
        if (!target || !target.parentElement) return
        if (target.parentElement.querySelector('[' + DRW_ENTRY + ']')) return
        entry = target.cloneNode(true)
        entry.className = String(target.className) + ' drw-entry-clone'
        entry.setAttribute(DRW_ENTRY, '')
        entry.setAttribute('data-dsh-plugin', 'dsh-remote-workspace')
        entry.setAttribute('aria-label', t('navLabel'))
        entry.removeAttribute('id')
        entry.innerHTML = ''
        const icon = document.createElement('span')
        icon.className = 'drw-entry-icon'
        icon.innerHTML = DRW_ICON
        const label = document.createElement('span')
        label.className = 'drw-entry-label'
        label.textContent = t('navLabel')
        entry.appendChild(icon)
        entry.appendChild(label)
        entry.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          toggle.toggle()
        })
        target.insertAdjacentElement('afterend', entry)
      }

      const reactDom = () => {
        if (typeof window !== 'undefined' && window.ReactDOM) return window.ReactDOM
        try { return require('react-dom/client') } catch (err) { return null }
      }

      const placeView = () => {
        const column = document.querySelector('[data-pane=conversation], [class*=centerCol]')
        if (!column) return
        if (!container) {
          container = document.createElement('div')
          container.setAttribute(DRW_VIEW, '')
          container.setAttribute('data-dsh-plugin', 'dsh-remote-workspace')
          column.appendChild(container)
          const ReactDOM = reactDom()
          if (ReactDOM && typeof ReactDOM.createRoot === 'function') {
            root = ReactDOM.createRoot(container)
            root.render(React.createElement(WorkspaceScreen, { ctx, onClose: () => toggle.set(false) }))
          }
          return
        }
        if (container.parentElement !== column) column.appendChild(container)
      }

      const applyOpen = () => {
        if (toggle.isOpen()) {
          document.documentElement.setAttribute(DRW_ACTIVE, '')
          document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: DRW_PANEL }))
          if (entry) entry.dataset.active = 'true'
        } else {
          document.documentElement.removeAttribute(DRW_ACTIVE)
          if (entry) delete entry.dataset.active
        }
      }

      const onOther = (event) => {
        if (event.detail !== DRW_PANEL && toggle.isOpen()) toggle.set(false)
      }
      const observer = new MutationObserver(() => { placeEntry(); placeView() })
      observer.observe(document.body, { childList: true, subtree: true })
      document.addEventListener('dsh-panel-activate', onOther)
      const unsubscribe = toggle.subscribe(applyOpen)
      placeEntry()
      placeView()

      return () => {
        observer.disconnect()
        document.removeEventListener('dsh-panel-activate', onOther)
        unsubscribe()
        document.documentElement.removeAttribute(DRW_ACTIVE)
        if (root && root.unmount) root.unmount()
        if (container) container.remove()
        if (entry) entry.remove()
      }
    }
