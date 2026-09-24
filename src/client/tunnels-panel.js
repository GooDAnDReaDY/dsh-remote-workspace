    function TunnelsPanel(panel) {
    const {
        t,
        busy,
        activeProfile,
        newTunnelLocal,
        setNewTunnelLocal,
        newTunnelRemote,
        setNewTunnelRemote,
        handleStartTunnel,
        tunnelMsg,
        tunnels,
        handleStopTunnel,
      } = panel
      return (
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
