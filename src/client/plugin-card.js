    function PluginCard(props) {
      const page = !!(props && props.view === 'page')
      const [open, setOpen] = React.useState(!!page)
      const t = props.t || (props.locale === 'zh' ? makeT(zh, en) : makeT(en, zh))

      React.useEffect(() => {
        ensureCss()
      }, [])

      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('subtitle'))
      }

      return React.createElement(
        page ? 'div' : 'li',
        { className: page ? 'drw-page' : 'drw-card', style: page ? undefined : { listStyle: 'none', marginBottom: '12px' } },
        React.createElement(
          'button',
          {
            type: 'button',
            style: {
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: page ? 'none' : 'flex',
              alignItems: 'center',
              width: '100%',
              padding: 0,
              textAlign: 'left',
            },
            'aria-expanded': page ? true : open,
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
        (page || open)
          ? React.createElement(
              'div',
              { style: { marginTop: '16px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '16px' } },
              React.createElement(React.Fragment, null, React.createElement(UpdaterSection, props), React.createElement(SettingsView, props))
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

