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
        // (0.1.6-alpha.2) renders as the plugin's own page with its configuration. The
        // label is a static string on purpose — it is resolved while the page renders,
        // and a locale lookup there would take the whole client batch down with it.
        ctx.slots.inject('plugins.item', () =>
          ctx.slots.register(
            {
              name: 'plugins.item',
              id: ROW_ID,
              order: 60,
              label: () => 'Remote Workspace',
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
