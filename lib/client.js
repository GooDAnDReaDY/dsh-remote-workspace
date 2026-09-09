window.__ModuleLoader__.load({
  id: '@goodandready/dsh-remote-workspace',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const NS = 'dsh-remote-workspace'
    const css =
      '.drw-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}' +
      '.drw-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.drw-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.drw-sub{color:var(--dsw-alias-label-secondary);font-size:13px}' +
      '.drw-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0}' +
      '.drw-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0}' +
      '.drw-badge{font-size:11px;font-family:monospace;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.2)}'

    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.getElementById('drw-styles')) return
      const el = document.createElement('style')
      el.id = 'drw-styles'
      el.textContent = css
      document.head.appendChild(el)
    }

    const en = {
      title: 'Remote Workspace',
      description: 'Manage SSH connections, SFTP sync, and tunnels',
      status: 'Ready',
      active: 'Active Host',
      none: 'No active remote host configured',
    }

    const ru = {
      title: 'Удалённое рабочее пространство',
      description: 'Управление подключениями по SSH, синхронизацией SFTP и туннелями',
      status: 'Готово',
      active: 'Активный хост',
      none: 'Нет активного подключения',
    }

    function RemoteWorkspaceCard(props) {
      ensureStyles()
      const [isOpen, setIsOpen] = React.useState(false)
      const t = props.locale === 'ru' ? ru : en

      return React.createElement(
        'li',
        { className: 'drw-card' },
        React.createElement(
          'button',
          { className: 'drw-head', onClick: () => setIsOpen(!isOpen) },
          React.createElement('span', { style: { fontSize: '20px' } }, '🌐'),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
            React.createElement('span', { className: 'drw-title' }, t.title),
            React.createElement('span', { className: 'drw-sub' }, t.description)
          ),
          React.createElement('span', { className: 'drw-badge' }, t.status)
        ),
        isOpen
          ? React.createElement(
              'div',
              { className: 'drw-body' },
              React.createElement(
                'div',
                { className: 'drw-row' },
                React.createElement('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t.active),
                React.createElement('span', { style: { fontSize: '13px', fontFamily: 'monospace' } }, t.none)
              )
            )
          : null
      )
    }

    function RemoteWorkspaceChip(props) {
      ensureStyles()
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
            color: 'var(--dsw-alias-label-secondary)',
            cursor: 'pointer'
          }
        },
        React.createElement('span', null, '🌐'),
        React.createElement('span', null, 'SSH: Remote')
      )
    }

    function apply(ctx) {
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'dsh-remote-workspace: dictionaries')
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
            (props) => React.createElement(RemoteWorkspaceCard, Object.assign({}, props, { ctx }))
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
