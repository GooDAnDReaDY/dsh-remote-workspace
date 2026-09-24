    function ClusterPanel(props) {
      const t = props.t
      const profiles = props.profiles || []
      const [command, setCommand] = React.useState('')
      const [environment, setEnvironment] = React.useState('')
      const [tag, setTag] = React.useState('')
      const [rows, setRows] = React.useState([])
      const [open, setOpen] = React.useState('')
      const [running, setRunning] = React.useState(false)
      const run = async () => {
        setRunning(true)
        try {
          const res = await fetch('/dsh-remote-workspace/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command,
              environment,
              tags: tag ? [tag] : [],
              maxWorkers: 8
            })
          })
          const data = await res.json()
          setRows(data && data.results ? data.results : [])
        } catch (err) {
          setRows([])
        }
        setRunning(false)
      }
      return React.createElement('div', { className: 'drw-card' },
        React.createElement('div', { className: 'drw-card-title' }, t('clusterTitle')),
        React.createElement('div', { className: 'drw-grid-2' },
          React.createElement('input', { className: 'drw-input', placeholder: t('fEnvironment'), value: environment, onChange: (e) => setEnvironment(e.target.value) }),
          React.createElement('input', { className: 'drw-input', placeholder: t('fTags'), value: tag, onChange: (e) => setTag(e.target.value) })
        ),
        React.createElement('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          React.createElement('input', { className: 'drw-input', placeholder: t('clusterCommand'), value: command, onChange: (e) => setCommand(e.target.value) }),
          React.createElement('button', { type: 'button', className: 'drw-btn drw-btn-primary', disabled: running || !command.trim(), onClick: run }, running ? t('clusterRunning') : t('clusterRun'))
        ),
        React.createElement('div', { className: 'drw-hint' }, t('clusterCount', { count: profiles.length })),
        rows.map((row, index) => React.createElement('div', { key: (row.alias || '') + index, className: 'drw-field' },
          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: () => setOpen(open === String(index) ? '' : String(index)) },
            (row.alias || row.host) + ' ' + (row.success ? t('clusterOk') : t('clusterFail')) + ' ' + (row.durationMs || 0) + ' ms'
          ),
          open === String(index)
            ? React.createElement('pre', { className: 'drw-term-body' }, row.error || row.stdout || row.stderr || '')
            : null
        ))
      )
    }
