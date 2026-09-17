    function apply(ctx) {
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-remote-workspace: dictionaries');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
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
