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
        } catch (err) { /* best-effort cleanup */ }
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
        } catch (err) { /* best-effort cleanup */ }
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
                  React.createElement('pre', { style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', padding: '12px', borderRadius: '8px', fontSize: '12px', maxHeight: '420px', overflowY: 'auto', whiteSpace: 'pre-wrap' } }, logsLoading ? 'Fetching logs...' : logsContent)
                )
              )
            )
          : null
      )
    }

    // --- Sub-component: Web Terminal Tab ---
