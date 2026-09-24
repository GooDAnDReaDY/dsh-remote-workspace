    function apply(ctx) {
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-remote-workspace: dictionaries');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
      }

      if (ctx.slots && typeof ctx.slots.inject === 'function') {
        // Plugin-list seat (plugins.item) first: the seat the current core
        // (0.1.6-alpha.2) renders as the plugin's own page with its configuration.
        // The label getter runs during page render. A locale-service lookup there
        // crashes the client batch, so the title is read from the dictionaries
        // already loaded in this bundle. English is the result when the active
        // language cannot be read.
        ctx.slots.inject('plugins.item', () =>
          ctx.slots.register(
            {
              name: 'plugins.item',
              id: ROW_ID,
              order: 60,
              label: () => {
                try {
                  const lang = ctx.locale && typeof ctx.locale.getLocale === 'function'
                    ? ctx.locale.getLocale()
                    : ''
                  if (typeof lang === 'string' && (lang === 'zh' || lang.indexOf('zh') === 0)) return zh.title
                } catch (err) {
                  return en.title
                }
                return en.title
              },
              locale: NS,
              inject: () => ({ ctx })
            },
            (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx }))
          )
        )

        // Row seat and the legacy seat stay as fallbacks.
        ctx.slots.inject('plugins.row.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.row.config',
              key: ROW_CONFIG_KEY,
              locale: NS,
              inject: () => ({ ctx })
            },
            (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx }))
          )
        )

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
