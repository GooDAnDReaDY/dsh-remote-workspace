    function SyncPanel(panel) {
    const {
        t,
        busy,
        activeProfile,
        handleSync,
        syncMsg,
        autoSync,
        setAutoSync,
        reportAction,
        setActionError,
      } = panel
      return (
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
                        const data = await reportAction(res)
                        if (data && data.ok) setAutoSync(data.autoSync)
                      } catch (err) {
                        setActionError(err && err.message ? err.message : t('actionFailed'))
                      }
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
          : null
      )
    }
