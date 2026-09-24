
    function groupProfiles(list, mode) {
      const profiles = Array.isArray(list) ? list : []
      const bucket = (map, key, profile) => {
        const name = key || 'ungrouped'
        if (!map.has(name)) map.set(name, [])
        map.get(name).push(profile)
      }
      if (mode === 'environment') {
        const map = new Map()
        profiles.forEach((profile) => bucket(map, String(profile.environment || '').trim(), profile))
        return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
      }
      if (mode === 'tag') {
        const map = new Map()
        profiles.forEach((profile) => {
          const tags = Array.isArray(profile.tags) ? profile.tags.map((item) => String(item).trim()).filter(Boolean) : []
          if (!tags.length) bucket(map, '', profile)
          else tags.forEach((tag) => bucket(map, tag, profile))
        })
        return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
      }
      return [{ key: 'all', items: profiles }]
    }

    function ProfilesPanel(panel) {
    const {
        t,
        editing,
        setEditing,
        setTestResult,
        profiles,
        activeId,
        busy,
        handleSave,
        testResult,
        handleTest,
        handleSetActive,
        handleDelete,
        browserOpen,
        setBrowserOpen,
        browserPath,
        browserEntries,
        browserLoading,
        openDirectoryBrowser,
        fetchRemoteDir,
        showPassword,
        setShowPassword,
      } = panel
      const [groupMode, setGroupMode] = React.useState('flat')
      const [groupReport, setGroupReport] = React.useState([])
      const sections = groupProfiles(profiles, groupMode)
      const testGroup = async (items) => {
        try {
          const res = await fetch('/dsh-remote-workspace/profiles/test-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: items.map((item) => item.id) })
          })
          const data = await res.json()
          if (data && data.ok) setGroupReport(data.results || [])
        } catch (err) {
          setGroupReport([])
        }
      }
      return (
        React.createElement(
          'div',
          { className: 'drw-card' },
          React.createElement(
            'div',
            { className: 'drw-card-title' },
            React.createElement('span', null, t('profilesTitle')),
            !editing
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'drw-btn drw-btn-primary',
                    onClick: () => {
                      setEditing({
                        id: 'prof_' + Math.random().toString(36).substr(2, 9),
                        name: 'New Server',
                        host: '',
                        port: 22,
                        username: 'root',
                        authType: 'key',
                        privateKeyPath: '~/.ssh/id_rsa',
                        passphrase: '',
                        password: '',
                        remoteWorkspace: '',
                        localMirrorPath: '',
                        environment: '',
                        tags: [],
                        location: '',
                        description: ''
                      })
                      setTestResult(null)
                    }
                  },
                  t('addBtn')
                )
              : null
          ),
          React.createElement('div', { className: 'drw-card-desc' }, t('profilesDesc')),

          // Interactive Editing Form
          editing
            ? React.createElement(
                'div',
                {
                  style: {
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }
                },
                React.createElement(
                  'div',
                  { style: { fontWeight: 600, fontSize: '14px', color: 'var(--dsw-alias-label-primary)' } },
                  editing.name ? t('formTitleEdit') : t('formTitleNew')
                ),
                React.createElement(
                  'div',
                  { className: 'drw-grid-2' },
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fName')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: editing.name || '',
                      onChange: (e) => setEditing({ ...editing, name: e.target.value })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fHost')),
                    React.createElement('input', {
                      className: 'drw-input',
                      placeholder: '192.168.1.100 or server.domain.com',
                      value: editing.host || '',
                      onChange: (e) => setEditing({ ...editing, host: e.target.value })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fPort')),
                    React.createElement('input', {
                      className: 'drw-input',
                      type: 'number',
                      value: editing.port || 22,
                      onChange: (e) => setEditing({ ...editing, port: parseInt(e.target.value, 10) || 22 })
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fUser')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: editing.username || '',
                      onChange: (e) => setEditing({ ...editing, username: e.target.value })
                    })
                  )
                ),

                React.createElement(
                  'div',
                  { className: 'drw-field' },
                  React.createElement('span', { className: 'drw-label' }, t('fJumpHosts')),
                  React.createElement('input', {
                    className: 'drw-input',
                    placeholder: 'bastion-a, bastion-b',
                    value: editing.jumpHostId || ((editing.jumpHosts || []).join(', ')),
                    onChange: (e) => {
                      const raw = e.target.value;
                      const jumpHosts = raw.split(',').map((item) => item.trim()).filter(Boolean);
                      setEditing({ ...editing, jumpHostId: raw, jumpHosts });
                    }
                  }),
                  React.createElement('span', { className: 'drw-hint' }, t('fJumpHostsHint'))
                ),

                React.createElement(
                  'div',
                  { className: 'drw-field' },
                  React.createElement('span', { className: 'drw-label' }, t('fProxyCommand')),
                  React.createElement('input', {
                    className: 'drw-input',
                    placeholder: 'cloudflared access ssh --hostname %h',
                    value: editing.proxyCommand || '',
                    onChange: (e) => setEditing({ ...editing, proxyCommand: e.target.value })
                  }),
                  React.createElement('span', { className: 'drw-hint' }, t('fProxyCommandHint'))
                ),


                React.createElement(
                  'div',
                  { className: 'drw-grid-2' },
                  React.createElement('div', { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fEnvironment')),
                    React.createElement('input', { className: 'drw-input', value: editing.environment || '', onChange: (e) => setEditing({ ...editing, environment: e.target.value }) })
                  ),
                  React.createElement('div', { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fLocation')),
                    React.createElement('input', { className: 'drw-input', value: editing.location || '', onChange: (e) => setEditing({ ...editing, location: e.target.value }) })
                  ),
                  React.createElement('div', { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fTags')),
                    React.createElement('input', {
                      className: 'drw-input',
                      value: Array.isArray(editing.tags) ? editing.tags.join(', ') : (editing.tags || ''),
                      onChange: (e) => setEditing({ ...editing, tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })
                    })
                  ),
                  React.createElement('div', { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fDescription')),
                    React.createElement('input', { className: 'drw-input', value: editing.description || '', onChange: (e) => setEditing({ ...editing, description: e.target.value }) })
                  )
                ),

                // Auth Method Segmented Switcher (Key vs Password)
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  React.createElement('span', { className: 'drw-label' }, t('fAuthType')),
                  React.createElement(
                    'div',
                    { className: 'drw-segmented' },
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: `drw-segmented-item ${editing.authType !== 'password' && editing.authType !== 'agent' ? 'drw-segmented-item-active' : ''}`,
                        onClick: () => setEditing({ ...editing, authType: 'key' })
                      },
                      '🔑 ' + t('fAuthKey')
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: `drw-segmented-item ${editing.authType === 'agent' ? 'drw-segmented-item-active' : ''}`,
                        onClick: () => setEditing({ ...editing, authType: 'agent' })
                      },
                      t('fAuthAgent')
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: `drw-segmented-item ${editing.authType === 'password' ? 'drw-segmented-item-active' : ''}`,
                        onClick: () => setEditing({ ...editing, authType: 'password' })
                      },
                      '🔒 ' + t('fAuthPass')
                    )
                  )
                ),

                // Conditional Auth Inputs
                editing.authType === 'agent'
                  ? React.createElement(
                      'div',
                      { className: 'drw-field' },
                      React.createElement('span', { className: 'drw-label' }, t('fAgentPath')),
                      React.createElement('input', {
                        className: 'drw-input',
                        placeholder: t('fAgentPathHint'),
                        value: editing.agentPath || '',
                        onChange: (e) => setEditing({ ...editing, agentPath: e.target.value })
                      })
                    )
                  : editing.authType === 'password'
                  ? React.createElement(
                      'div',
                      { className: 'drw-field' },
                      React.createElement('span', { className: 'drw-label' }, t('fPassword')),
                      React.createElement(
                        'div',
                        { style: { display: 'flex', gap: '8px' } },
                        React.createElement('input', {
                          className: 'drw-input',
                          type: showPassword ? 'text' : 'password',
                          placeholder: '••••••••••••',
                          value: editing.password || '',
                          onChange: (e) => setEditing({ ...editing, password: e.target.value })
                        }),
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            className: 'drw-btn',
                            style: { fontSize: '11px', whiteSpace: 'nowrap' },
                            onClick: () => setShowPassword((v) => !v)
                          },
                          showPassword ? 'Hide' : 'Show'
                        )
                      )
                    )
                  : React.createElement(
                      'div',
                      { className: 'drw-grid-2' },
                      React.createElement(
                        'div',
                        { className: 'drw-field' },
                        React.createElement('span', { className: 'drw-label' }, t('fKeyPath')),
                        React.createElement('input', {
                          className: 'drw-input',
                          placeholder: '~/.ssh/id_rsa or /home/user/.ssh/id_ed25519',
                          value: editing.privateKeyPath || '',
                          onChange: (e) => setEditing({ ...editing, privateKeyPath: e.target.value })
                        }),
                        React.createElement('span', { className: 'drw-hint' }, t('fKeyPathHint'))
                      ),
                      React.createElement(
                        'div',
                        { className: 'drw-field' },
                        React.createElement('span', { className: 'drw-label' }, t('fPassphrase')),
                        React.createElement('input', {
                          className: 'drw-input',
                          type: 'password',
                          placeholder: 'Optional passphrase',
                          value: editing.passphrase || '',
                          onChange: (e) => setEditing({ ...editing, passphrase: e.target.value })
                        })
                      )
                    ),

                // Workspace Paths (Remote Workspace & Local Mirror)
                React.createElement(
                  'div',
                  { className: 'drw-grid-2' },
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fRemotePath')),
                    React.createElement(
                      'div',
                      { style: { display: 'flex', gap: '8px' } },
                      React.createElement('input', {
                        className: 'drw-input',
                        placeholder: '/home/user/project',
                        value: editing.remoteWorkspace || '',
                        onChange: (e) => setEditing({ ...editing, remoteWorkspace: e.target.value })
                      }),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'drw-btn',
                          style: { whiteSpace: 'nowrap', fontSize: '12px' },
                          disabled: !editing.host,
                          onClick: () => openDirectoryBrowser(editing.remoteWorkspace || '/')
                        },
                        t('btnBrowse')
                      )
                    ),
                    React.createElement('span', { className: 'drw-hint' }, t('fRemotePathHint'))
                  ),
                  React.createElement(
                    'div',
                    { className: 'drw-field' },
                    React.createElement('span', { className: 'drw-label' }, t('fLocalMirror')),
                    React.createElement('input', {
                      className: 'drw-input',
                      placeholder: '~/.dsh/mirrors/my-project',
                      value: editing.localMirrorPath || '',
                      onChange: (e) => setEditing({ ...editing, localMirrorPath: e.target.value })
                    }),
                    React.createElement('span', { className: 'drw-hint' }, t('fLocalMirrorHint'))
                  )
                ),

                // Directory Browser Modal
                browserOpen
                  ? React.createElement(
                      'div',
                      { className: 'drw-browser-modal' },
                      React.createElement(
                        'div',
                        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        React.createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, `📂 ${browserPath}`),
                        React.createElement(
                          'div',
                          { style: { display: 'flex', gap: '6px' } },
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn drw-btn-primary',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => {
                                setEditing({ ...editing, remoteWorkspace: browserPath })
                                setBrowserOpen(false)
                              }
                            },
                            t('btnSelectThis')
                          ),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => setBrowserOpen(false)
                            },
                            '✕'
                          )
                        )
                      ),
                      React.createElement(
                        'div',
                        { className: 'drw-browser-list' },
                        browserLoading
                          ? React.createElement('div', { style: { padding: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, 'Loading directory entries...')
                          : React.createElement(
                              React.Fragment,
                              null,
                              browserPath !== '/'
                                ? React.createElement(
                                    'div',
                                    {
                                      className: 'drw-browser-item',
                                      onClick: () => {
                                        const parent = browserPath.substring(0, browserPath.lastIndexOf('/')) || '/'
                                        fetchRemoteDir(parent)
                                      }
                                    },
                                    '📁 .. (parent directory)'
                                  )
                                : null,
                              browserEntries
                                .filter((e) => e.isDirectory)
                                .map((e) =>
                                  React.createElement(
                                    'div',
                                    {
                                      key: e.filename,
                                      className: 'drw-browser-item',
                                      onClick: () => {
                                        const next = browserPath === '/' ? `/${e.filename}` : `${browserPath}/${e.filename}`
                                        fetchRemoteDir(next)
                                      }
                                    },
                                    `📁 ${e.filename}`
                                  )
                                )
                            )
                      )
                    )
                  : null,

                // Form Action Buttons
                React.createElement(
                  'div',
                  { className: 'drw-row', style: { justifyContent: 'flex-end', marginTop: '6px' } },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      disabled: !editing.host || !!busy,
                      onClick: () => handleTest(editing)
                    },
                    busy === 'testing' ? t('testing') : t('btnTest')
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn',
                      onClick: () => {
                        setEditing(null)
                        setBrowserOpen(false)
                        setTestResult(null)
                      }
                    },
                    t('btnCancel')
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'drw-btn drw-btn-primary',
                      disabled: !editing.host || !!busy,
                      onClick: () => handleSave(editing)
                    },
                    busy === 'saving' ? t('saving') : t('btnSave')
                  )
                ),
                testResult
                  ? React.createElement(
                      'div',
                      {
                        className: 'drw-preview',
                        style: {
                          borderColor: testResult.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)'
                        }
                      },
                      testResult.ok
                        ? t('testOk', { latency: testResult.latencyMs ?? testResult.latency ?? 0, os: testResult.remoteOs || testResult.os || 'Linux' })
                        : t('testFail', { err: testResult.error || 'Connection timed out' })
                    )
                  : null
              )
            : null,


          React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
            ['flat', 'environment', 'tag'].map((mode) => React.createElement('button', {
              key: mode,
              type: 'button',
              className: groupMode === mode ? 'drw-btn drw-btn-primary' : 'drw-btn',
              onClick: () => setGroupMode(mode)
            }, t(mode === 'flat' ? 'groupFlat' : mode === 'environment' ? 'groupEnvironment' : 'groupTag')))
          ),
          groupReport.length
            ? React.createElement('div', { className: 'drw-hint', role: 'status' },
                groupReport.map((item) => React.createElement('div', { key: item.id + (item.name || '') },
                  (item.name || item.id) + ': ' + (item.ok ? t('groupOnline', { latency: item.latencyMs || 0 }) : t('groupOffline', { err: item.error || '' }))
                ))
              )
            : null,

          // Profiles List Table
          profiles.length > 0
            ? React.createElement(
                'table',
                { className: 'drw-table' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, t('nameCol')),
                    React.createElement('th', null, t('hostCol')),
                    React.createElement('th', null, t('portCol')),
                    React.createElement('th', null, t('pathCol')),
                    React.createElement('th', { style: { textAlign: 'right' } }, t('actionsCol'))
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  sections.flatMap((section) => {
                    const header = groupMode === 'flat' ? [] : [
                      React.createElement('tr', { key: 'group-' + section.key },
                        React.createElement('td', { colSpan: 5 },
                          React.createElement('strong', null, section.key === 'ungrouped' ? t('groupUngrouped') : section.key),
                          ' ',
                          React.createElement('button', { type: 'button', className: 'drw-btn', onClick: () => testGroup(section.items) }, t('testGroup'))
                        )
                      )
                    ]
                    return header.concat(section.items.map((p) => {
                    const isAct = p.id === activeId
                    return React.createElement(
                      'tr',
                      { key: p.id },
                      React.createElement(
                        'td',
                        null,
                        React.createElement('span', { style: { fontWeight: 600 } }, p.name || 'Server'),
                        React.createElement(
                          'span',
                          { className: 'drw-badge', style: { marginLeft: '8px' } },
                          p.authType === 'password' ? '🔒 ' + t('fAuthPassShort') : p.authType === 'agent' ? t('fAuthAgentShort') : '🔑 ' + t('fAuthKeyShort')
                        ),
                        isAct
                          ? React.createElement('span', { className: 'drw-badge drw-badge-ok', style: { marginLeft: '6px' } }, t('activeBadge'))
                          : null
                      ),
                      React.createElement('td', { style: { fontFamily: 'monospace' } }, `${p.username || 'root'}@${p.host}`),
                      React.createElement('td', { style: { fontFamily: 'monospace' } }, p.port || 22),
                      React.createElement('td', { style: { fontFamily: 'monospace', fontSize: '12px' } }, p.remoteWorkspace || '—'),
                      React.createElement(
                        'td',
                        { style: { textAlign: 'right' } },
                        React.createElement(
                          'div',
                          { style: { display: 'inline-flex', gap: '6px' } },
                          !isAct
                            ? React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  className: 'drw-btn',
                                  style: { fontSize: '11px', padding: '3px 8px' },
                                  onClick: () => handleSetActive(p.id)
                                },
                                t('pinBtn')
                              )
                            : null,
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => {
                                setEditing({ ...p })
                                setTestResult(null)
                              }
                            },
                            t('editBtn')
                          ),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'drw-btn drw-btn-danger',
                              style: { fontSize: '11px', padding: '3px 8px' },
                              onClick: () => handleDelete(p.id, p.name)
                            },
                            t('delBtn')
                          )
                        )
                      )
                    )
                  }))
                  })
                )
              )
            : !editing
            ? React.createElement('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('noHosts'))
            : null
        )
      )
    }
