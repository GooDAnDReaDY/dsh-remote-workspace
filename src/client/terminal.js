    function TerminalTab(props) {
      const { activeProfile, t } = props
      const [connected, setConnected] = React.useState(false)
      const [sessionId, setSessionId] = React.useState(null)
      const [output, setOutput] = React.useState('')
      const [cmdInput, setCmdInput] = React.useState('')
      const [loading, setLoading] = React.useState(false)
      const termEndRef = React.useRef(null)
      const evtSourceRef = React.useRef(null)

      React.useEffect(() => {
        if (termEndRef.current) {
          termEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, [output])

      React.useEffect(() => {
        return () => {
          if (evtSourceRef.current) {
            evtSourceRef.current.close()
          }
        }
      }, [])

      const handleConnect = async () => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/terminal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, cols: 80, rows: 24 })
          })
          const data = await res.json()
          if (data.ok && data.sessionId) {
            setSessionId(data.sessionId)
            setConnected(true)
            setOutput((prev) => prev + `\n[+] ` + t('termConnected', { id: data.sessionId, host: activeProfile.host }) + `\n`)

            // Connect SSE stream
            const es = new EventSource(`/dsh-remote-workspace/terminal/stream?sessionId=${data.sessionId}`)
            evtSourceRef.current = es
            es.onmessage = (e) => {
              try {
                const parsed = JSON.parse(e.data)
                if (parsed.chunk) {
                  setOutput((p) => p + parsed.chunk)
                }
              } catch (err) { /* best-effort cleanup */ }
            }
            es.onerror = () => {
              setOutput((p) => p + `\n[-] ` + t('termDisconnected') + `\n`)
              setConnected(false)
              es.close()
            }
          }
        } catch (err) {
          setOutput((p) => p + `\n[!] Connection error: ${err.message}\n`)
        }
        setLoading(false)
      }

      const handleDisconnect = async () => {
        if (sessionId) {
          try {
            await fetch('/dsh-remote-workspace/terminal/close', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            })
          } catch (err) { /* best-effort cleanup */ }
        }
        if (evtSourceRef.current) {
          evtSourceRef.current.close()
        }
        setConnected(false)
        setSessionId(null)
        setOutput((p) => p + `\n[-] ` + t('termDisconnected') + `\n`)
      }

      const sendCommand = async (e) => {
        if (e) e.preventDefault()
        if (!cmdInput || !sessionId) return
        const toSend = cmdInput + '\n'
        setCmdInput('')
        try {
          await fetch('/dsh-remote-workspace/terminal/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, data: toSend })
          })
        } catch (err) { /* best-effort cleanup */ }
      }

      const sendCtrlC = async () => {
        if (!sessionId) return
        try {
          await fetch('/dsh-remote-workspace/terminal/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, data: '\x03' })
          })
        } catch (err) { /* best-effort cleanup */ }
      }

      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            React.createElement('span', { style: { fontWeight: 600, fontSize: '14px' } }, 'SSH PTY Shell:'),
            React.createElement(
              'span',
              { className: `drw-badge ${connected ? 'drw-badge-ok' : 'drw-badge-warn'}` },
              connected ? `🟢 Online (${activeProfile?.host})` : '⚪ Idle'
            )
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            !connected
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-primary',
                    disabled: !activeProfile || loading,
                    onClick: handleConnect
                  },
                  loading ? 'Connecting...' : t('termStart')
                )
              : React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-danger',
                    onClick: handleDisconnect
                  },
                  t('termStop')
                ),
            connected
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn',
                    onClick: sendCtrlC
                  },
                  'Ctrl+C'
                )
              : null,
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'drw-btn',
                onClick: () => setOutput('')
              },
              t('termClear')
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'drw-term-window' },
          React.createElement(
            'div',
            { className: 'drw-term-header' },
            React.createElement('span', null, `terminal ~ ${activeProfile?.username || 'user'}@${activeProfile?.host || 'remote'}`),
            React.createElement('span', null, connected ? `Session: ${sessionId}` : 'Offline')
          ),
          React.createElement(
            'div',
            { className: 'drw-term-body' },
            output || (activeProfile ? `[i] Ready to connect to ${activeProfile.username || 'root'}@${activeProfile.host}. Click 'Connect Terminal'.` : `[!] No active host profile selected. Configure and activate a profile first.`),
            React.createElement('div', { ref: termEndRef })
          ),
          connected
            ? React.createElement(
                'form',
                { className: 'drw-term-footer', onSubmit: sendCommand },
                React.createElement('span', { style: { color: 'var(--dsw-alias-link-primary)', padding: '4px 6px', fontFamily: 'monospace' } }, '$'),
                React.createElement('input', {
                  className: 'drw-term-input',
                  type: 'text',
                  placeholder: t('termPlaceholder'),
                  value: cmdInput,
                  onChange: (e) => setCmdInput(e.target.value)
                }),
                React.createElement(
                  'button',
                  { type: 'submit', className: 'drw-btn', style: { padding: '2px 8px', fontSize: '11px' } },
                  'Send ↵'
                )
              )
            : null
        )
      )
    }

    // --- Sub-component: Remote File Explorer Tab ---
