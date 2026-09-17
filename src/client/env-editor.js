    function EnvTab(props) {
      const { activeProfile, t } = props
      const [envEntries, setEnvEntries] = React.useState([])
      const [loading, setLoading] = React.useState(false)
      const [visibleKeys, setVisibleKeys] = React.useState({})
      const [editValues, setEditValues] = React.useState({})
      const [msg, setMsg] = React.useState('')

      const loadEnv = async () => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/env/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id })
          })
          const data = await res.json()
          if (data.ok && Array.isArray(data.entries)) {
            setEnvEntries(data.entries.filter((e) => e.type === 'var'))
            const initialEdits = {}
            data.entries.forEach((e) => {
              if (e.type === 'var') initialEdits[e.key] = e.value
            })
            setEditValues(initialEdits)
          }
        } catch (err) {
          setMsg(`Error loading .env: ${err.message}`)
        }
        setLoading(false)
      }

      React.useEffect(() => {
        loadEnv()
      }, [activeProfile?.id])

      const toggleVisible = (key) => {
        setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }))
      }

      const saveVar = async (key) => {
        try {
          const res = await fetch('/dsh-remote-workspace/env/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId: activeProfile.id,
              key,
              value: editValues[key] || ''
            })
          })
          const data = await res.json()
          if (data.ok) {
            setMsg(`Saved ${key} successfully!`)
            setTimeout(() => setMsg(''), 3000)
          }
        } catch (err) {
          setMsg(`Save failed: ${err.message}`)
        }
      }

      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: '14px' } }, t('envTitle')),
          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: loadEnv, disabled: loading }, loading ? 'Loading...' : '🔄 Refresh')
        ),
        msg ? React.createElement('div', { className: 'drw-badge drw-badge-ok' }, msg) : null,
        React.createElement(
          'div',
          { style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px', padding: '12px', background: 'var(--dsw-alias-bg-layer-2)' } },
          envEntries.length === 0
            ? React.createElement('div', { style: { textAlign: 'center', padding: '16px', color: 'var(--dsw-alias-label-secondary)' } }, 'No variables found in remote .env')
            : envEntries.map((e) =>
                React.createElement(
                  'div',
                  { key: e.key, className: 'drw-env-row' },
                  React.createElement('span', { style: { fontWeight: 600, fontFamily: 'monospace', fontSize: '12.5px' } }, e.key),
                  React.createElement('input', {
                    type: visibleKeys[e.key] ? 'text' : 'password',
                    className: 'drw-input',
                    value: editValues[e.key] !== undefined ? editValues[e.key] : e.value,
                    onChange: (ev) => {
                      const val = ev.target.value
                      setEditValues((prev) => ({ ...prev, [e.key]: val }))
                    }
                  }),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', gap: '4px', justifyContent: 'flex-end' } },
                    React.createElement('button', { type: 'button', className: 'drw-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => toggleVisible(e.key) }, visibleKeys[e.key] ? t('envHideVal') : t('envShowVal')),
                    React.createElement('button', { type: 'button', className: 'drw-btn drw-btn-primary', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => saveVar(e.key) }, t('envSaveVar'))
                  )
                )
              )
        )
      )
    }

    // --- Sub-component: Docker Containers Tab ---
