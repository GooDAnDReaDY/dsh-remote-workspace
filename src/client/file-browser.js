    function ExplorerTab(props) {
      const { activeProfile, t } = props
      const [currentPath, setCurrentPath] = React.useState(activeProfile?.remoteWorkspace || '/')
      const [entries, setEntries] = React.useState([])
      const [loading, setLoading] = React.useState(false)
      const [previewFile, setPreviewFile] = React.useState(null)
      const [previewContent, setPreviewContent] = React.useState('')
      const [editContent, setEditContent] = React.useState('')
      const [previewLoading, setPreviewLoading] = React.useState(false)
      const [saveStatus, setSaveStatus] = React.useState(null)
      const [transfer, setTransfer] = React.useState(null)
      const transferAbort = React.useRef(null)

      const loadDir = async (dirPath) => {
        if (!activeProfile) return
        setLoading(true)
        try {
          const res = await fetch('/dsh-remote-workspace/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, remotePath: dirPath })
          })
          const data = await res.json()
          if (data.ok && Array.isArray(data.entries)) {
            setCurrentPath(dirPath)
            setEntries(data.entries)
          }
        } catch (err) { /* best-effort cleanup */ }
        setLoading(false)
      }

      React.useEffect(() => {
        if (activeProfile) {
          loadDir(activeProfile.remoteWorkspace || '/')
        }
      }, [activeProfile?.id])

      const handleNavUp = () => {
        const parts = currentPath.split('/').filter(Boolean)
        parts.pop()
        const parent = '/' + parts.join('/')
        loadDir(parent || '/')
      }

      const openFile = async (entry) => {
        const filePath = currentPath.endsWith('/') ? currentPath + entry.filename : currentPath + '/' + entry.filename
        setPreviewLoading(true)
        setPreviewFile(filePath)
        setSaveStatus(null)
        try {
          const res = await fetch('/dsh-remote-workspace/file/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, filePath })
          })
          const data = await res.json()
          if (data.ok) {
            setPreviewContent(data.content)
            setEditContent(data.content)
          } else {
            setPreviewContent(`[Error loading file: ${data.error || 'Failed'}]`)
            setEditContent('')
          }
        } catch (err) {
          setPreviewContent(`[Error: ${err.message}]`)
        }
        setPreviewLoading(false)
      }


      const filePathFor = (entry) => currentPath.endsWith('/') ? currentPath + entry.filename : currentPath + '/' + entry.filename

      const downloadFile = async (entry, event) => {
        if (event) event.stopPropagation()
        if (!activeProfile) return
        const ctrl = new AbortController()
        transferAbort.current = () => ctrl.abort()
        setTransfer({ name: entry.filename, percent: 0 })
        try {
          const params = new URLSearchParams({ profileId: activeProfile.id, filePath: filePathFor(entry) })
          const res = await fetch('/dsh-remote-workspace/file/download?' + params.toString(), { signal: ctrl.signal })
          if (!res.ok || !res.body) {
            setTransfer({ name: entry.filename, error: true })
            return
          }
          const total = Number(res.headers.get('content-length')) || 0
          const reader = res.body.getReader()
          const chunks = []
          let loaded = 0
          while (true) {
            const step = await reader.read()
            if (step.done) break
            chunks.push(step.value)
            loaded += step.value.length
            setTransfer({ name: entry.filename, percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : 0 })
          }
          const blob = new Blob(chunks)
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = entry.filename
          link.click()
          URL.revokeObjectURL(link.href)
          setTransfer(null)
        } catch (err) {
          setTransfer({ name: entry.filename, error: err && err.name === 'AbortError' })
        }
      }

      const uploadFile = () => {
        if (!activeProfile) return
        const input = document.createElement('input')
        input.type = 'file'
        input.onchange = () => {
          const file = input.files && input.files[0]
          if (!file) return
          const remotePath = currentPath.endsWith('/') ? currentPath + file.name : currentPath + '/' + file.name
          const xhr = new XMLHttpRequest()
          const params = new URLSearchParams({ profileId: activeProfile.id, filePath: remotePath })
          xhr.open('POST', '/dsh-remote-workspace/file/upload?' + params.toString())
          transferAbort.current = () => xhr.abort()
          setTransfer({ name: file.name, percent: 0 })
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setTransfer({ name: file.name, percent: Math.min(100, Math.round((event.loaded / event.total) * 100)) })
            }
          }
          xhr.onload = () => {
            setTransfer(null)
            if (xhr.status >= 200 && xhr.status < 300) loadDir(currentPath)
            else setTransfer({ name: file.name, error: true })
          }
          xhr.onerror = () => setTransfer({ name: file.name, error: true })
          xhr.onabort = () => setTransfer({ name: file.name, error: true })
          xhr.send(file)
        }
        input.click()
      }

      const handleSaveFile = async () => {
        if (!previewFile || !activeProfile) return
        setSaveStatus('saving')
        try {
          const res = await fetch('/dsh-remote-workspace/file/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: activeProfile.id, filePath: previewFile, content: editContent })
          })
          const data = await res.json()
          if (data.ok) {
            setSaveStatus('saved')
            setPreviewContent(editContent)
          } else {
            setSaveStatus('error')
          }
        } catch (_) {
          setSaveStatus('error')
        }
      }

      return React.createElement(
        'div',
        { className: 'drw-explorer-box' },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: '14px' } }, t('explorerTitle')),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'drw-btn',
              onClick: () => loadDir(currentPath),
              disabled: loading
            },
            loading ? 'Refreshing...' : '🔄 Refresh'
          ),
          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: uploadFile }, t('btnUpload'))
        ),
        transfer
          ? React.createElement('div', { className: 'drw-hint', role: 'status' },
              transfer.error ? t('transferFailed', { name: transfer.name }) : t('transferProgress', { name: transfer.name, percent: transfer.percent || 0 }),
              React.createElement('button', { type: 'button', className: 'drw-btn', onClick: () => transferAbort.current && transferAbort.current() }, t('transferCancel'))
            )
          : null,
        React.createElement(
          'div',
          { className: 'drw-explorer-nav' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'drw-btn',
              style: { padding: '2px 8px', fontSize: '11px' },
              onClick: handleNavUp,
              disabled: currentPath === '/' || loading
            },
            '⬆️ Up'
          ),
          React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, 'Path:'),
          React.createElement('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-state-brand-primary)' } }, currentPath)
        ),
        React.createElement(
          'div',
          { className: 'drw-file-list' },
          entries.length === 0
            ? React.createElement('div', { style: { padding: '16px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)' } }, loading ? 'Reading directory...' : 'Directory is empty.')
            : entries.map((e) =>
                React.createElement(
                  'div',
                  {
                    key: e.filename,
                    className: 'drw-file-row',
                    onClick: () => (e.isDirectory ? loadDir(currentPath.endsWith('/') ? currentPath + e.filename : currentPath + '/' + e.filename) : openFile(e))
                  },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    React.createElement('span', null, e.isDirectory ? '📁' : '📄'),
                    React.createElement('span', { style: { fontWeight: e.isDirectory ? 600 : 400 } }, e.filename)
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-file-meta' },
                    e.size !== undefined ? React.createElement('span', null, `${Math.round(e.size / 1024)} KB`) : null,
                    e.permissions ? React.createElement('span', { style: { opacity: 0.6 } }, e.permissions) : null,
                    e.isDirectory ? null : React.createElement('button', { type: 'button', className: 'drw-btn', onClick: (event) => downloadFile(e, event) }, t('btnDownload'))
                  )
                )
              )
        ),
        // File Preview / Edit Modal
        previewFile
          ? React.createElement(
              'div',
              { className: 'drw-modal-overlay', onClick: () => setPreviewFile(null) },
              React.createElement(
                'div',
                { className: 'drw-modal-dialog', onClick: (e) => e.stopPropagation() },
                React.createElement(
                  'div',
                  { className: 'drw-modal-hdr' },
                  React.createElement('span', { style: { fontFamily: 'monospace' } }, t('filePreviewTitle', { path: previewFile })),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      style: { padding: '2px 8px' },
                      onClick: () => setPreviewFile(null)
                    },
                    '✕'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'drw-modal-body', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                  previewLoading
                    ? React.createElement('div', { style: { padding: '20px', textAlign: 'center' } }, 'Loading content...')
                    : React.createElement('textarea', {
                        style: {
                          width: '100%',
                          height: '320px',
                          background: 'var(--dsw-alias-bg-layer-1)',
                          color: 'var(--dsw-alias-label-primary)',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          padding: '10px',
                          border: '1px solid var(--dsw-alias-border-l2)',
                          borderRadius: '8px',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        },
                        value: editContent,
                        onChange: (e) => setEditContent(e.target.value)
                      }),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                    React.createElement(
                      'span',
                      { style: { fontSize: '12px', color: saveStatus === 'saved' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)' } },
                      saveStatus === 'saved' ? t('fileSaved') : saveStatus === 'error' ? 'Error saving file.' : ''
                    ),
                    React.createElement(
                      'div',
                      { style: { display: 'flex', gap: '8px' } },
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn',
                          onClick: () => setPreviewFile(null)
                        },
                        'Close'
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn drw-btn-primary',
                          onClick: handleSaveFile,
                          disabled: saveStatus === 'saving'
                        },
                        saveStatus === 'saving' ? 'Saving...' : t('btnSaveFile')
                      )
                    )
                  )
                )
              )
            )
          : null
      )
    }

