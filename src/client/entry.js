    function apply(ctx) {
      try { mountRemoteWorkspace(ctx) } catch (err) { console.warn('[dsh-remote-workspace] workspace mount skipped', err && err.message) }
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-remote-workspace: dictionaries');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
      }

      let placed = false;
      const registerPluginSlots = (c) => {
        if (!c.slots || typeof c.slots.inject !== 'function') return () => {};
        if (placed) return () => {};
        placed = true;

        // Plugin-list seat (plugins.item) first
        const offListItem = c.slots.inject('plugins.item', () => {
          try {
            return c.slots.register(
              {
                name: 'plugins.item',
                id: ROW_ID,
                key: ROW_ID,
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
            );
          } catch (err) {
            console.warn('[dsh-remote-workspace] plugins.item registration skipped:', err && err.message);
          }
        });

        // Row seat (plugins.row.config)
        const offRow = c.slots.inject('plugins.row.config', () => {
          try {
            return c.slots.register(
              {
                name: 'plugins.row.config',
                key: ROW_CONFIG_KEY,
                locale: NS,
                inject: () => ({ ctx: c })
              },
              (props) => React.createElement(PluginCard, Object.assign({}, props, { ctx: c }))
            );
          } catch (err) {
            console.warn('[dsh-remote-workspace] plugins.row.config registration skipped:', err && err.message);
          }
        });

        const offHeader = c.slots.inject('conversation.session.header.utilities', () => {
          try {
            return c.slots.register(
              {
                name: 'conversation.session.header.utilities',
                id: '@goodandready/dsh-remote-workspace',
                order: 30
              },
              (props) => React.createElement(RemoteWorkspaceChip, props)
            );
          } catch (err) {
            console.warn('[dsh-remote-workspace] header utilities registration skipped:', err && err.message);
          }
        });

        return () => {
          placed = false;
          try { if (typeof offListItem === 'function') offListItem(); } catch (_err) {}
          try { if (typeof offRow === 'function') offRow(); } catch (_err) {}
          try { if (typeof offHeader === 'function') offHeader(); } catch (_err) {}
        };
      };

      if (ctx.inject && typeof ctx.inject === 'function') {
        ctx.inject(['configForms'], (c) => {
          const forms = c.configForms;
          if (forms && typeof forms.whileServed === 'function') {
            const gate = () => forms.whileServed([NS], () => registerPluginSlots(c));
            if (typeof c.effect === 'function') {
              c.effect(gate, 'dsh-remote-workspace: plugins card');
            } else {
              gate();
            }
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
