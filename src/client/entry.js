    function apply(ctx) {
      try { mountRemoteWorkspace(ctx) } catch (err) { console.warn('[dsh-remote-workspace] workspace mount skipped', err && err.message) }
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-remote-workspace: dictionaries');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
      }

      const registerPluginSlots = (c) => {
        if (!c.slots || typeof c.slots.inject !== 'function') return;

        // Plugin-list seat (plugins.item) first
        c.slots.inject('plugins.item', () =>
          c.slots.register(
            {
              name: 'plugins.item',
              id: ROW_ID,
              order: 60,
              label: () => {
                try {
                  const lang = c.locale && typeof c.locale.getLocale === 'function'
                    ? c.locale.getLocale()
                    : ''
                  if (typeof lang === 'string' && (lang === 'zh' || lang.indexOf('zh') === 0)) return zh.title
                } catch (err) {
                  return en.title
                }
                return en.title
              },
              locale: NS,
              inject: () => ({ ctx: c })
            },
            (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx: c }))
          )
        );

        // Row seat (plugins.row.config)
        c.slots.inject('plugins.row.config', () =>
          c.slots.register(
            {
              name: 'plugins.row.config',
              key: ROW_CONFIG_KEY,
              locale: NS,
              inject: () => ({ ctx: c })
            },
            (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx: c }))
          )
        );

        c.slots.inject('conversation.session.header.utilities', () =>
          c.slots.register(
            {
              name: 'conversation.session.header.utilities',
              id: '@goodandready/dsh-remote-workspace',
              order: 30
            },
            (props) => React.createElement(RemoteWorkspaceChip, props)
          )
        );
      };

      if (ctx.inject && typeof ctx.inject === 'function') {
        ctx.inject(['configForms'], (c) => {
          const forms = c.configForms;
          if (forms && typeof forms.whileServed === 'function') {
            c.effect(() => forms.whileServed([NS], () => {
              registerPluginSlots(c);
            }), 'dsh-remote-workspace: plugins card');
          } else {
            registerPluginSlots(c);
          }
        });
      } else {
        registerPluginSlots(ctx);
      }
    }

    module.exports = { apply, inject: ['slots', 'locale', 'configForms'] }
    return module.exports
