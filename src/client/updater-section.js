    function UpdaterSection(props) {
      const t = props.t || ((k) => k);
      const [updateStatus, setUpdateStatus] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [updating, setUpdating] = React.useState(false);
      const [msg, setMsg] = React.useState(null);

      const checkUpdate = React.useCallback(async () => {
        setLoading(true);
        setMsg(null);
        try {
          const res = await fetch('/dsh-remote-workspace/update', {
            headers: { accept: 'application/json' },
            cache: 'no-store'
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          setUpdateStatus(data);
        } catch (e) {
          setMsg({ ok: false, text: (t('updateFailed') || 'Failed: ') + (e?.message || String(e)) });
        } finally {
          setLoading(false);
        }
      }, [t]);

      const doUpdate = async () => {
        setUpdating(true);
        setMsg(null);
        try {
          const res = await fetch('/dsh-remote-workspace/update', {
            method: 'POST',
            headers: {
              'x-dsh-plugin-update': '1',
              'content-type': 'application/json'
            }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          setUpdateStatus(data);
          if (data.restartRequired) {
            setMsg({ ok: true, text: t('restartRequired') });
          }
        } catch (e) {
          setMsg({ ok: false, text: (t('updateFailed') || 'Update failed: ') + (e?.message || String(e)) });
        } finally {
          setUpdating(false);
        }
      };

      React.useEffect(() => {
        checkUpdate();
      }, [checkUpdate]);

      return React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '8px',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l2)',
            fontSize: '13px'
          }
        },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('span', null, '📦'),
          React.createElement(
            'div',
            null,
            React.createElement('span', { style: { fontWeight: 500 } }, 'v' + (updateStatus?.currentVersion || '0.3.1')),
            updateStatus?.latestVersion && updateStatus.latestVersion !== updateStatus.currentVersion
              ? React.createElement('span', { style: { marginLeft: '8px', color: 'var(--dsw-alias-state-warning-text)' } }, '→ v' + updateStatus.latestVersion)
              : null,
            msg
              ? React.createElement('div', { style: { fontSize: '11px', marginTop: '3px', color: msg.ok ? 'var(--dsw-alias-state-success-text)' : 'var(--dsw-alias-state-error-text)' } }, msg.text)
              : null
          )
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          updateStatus?.updateAvailable
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'drw-btn drw-btn-primary',
                  disabled: updating,
                  onClick: doUpdate,
                  style: { fontSize: '12px', padding: '4px 10px' }
                },
                updating ? t('updating') : t('updateNow')
              )
            : React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'drw-btn',
                  disabled: loading,
                  onClick: checkUpdate,
                  style: { fontSize: '12px', padding: '4px 10px' }
                },
                loading ? t('checking') : (updateStatus?.updateAvailable === false ? t('upToDate') : t('checkUpdate'))
              )
        )
      );
    }

