/**
 * @typedef {Object} MachineProfile
 * @property {string} id
 * @property {string} name
 * @property {string} host
 * @property {number} port
 * @property {string} username
 * @property {'key'|'password'|'agent'} authType
 * @property {string} [privateKeyPath]
 * @property {string} [privateKey]
 * @property {string} [passphrase]
 * @property {string} [password]
 * @property {string} [jumpHost]
 * @property {string} [remoteWorkspace]
 * @property {string} [localMirrorPath]
 * @property {number} [lastPingMs]
 * @property {string} [remoteOs]
 */

/**
 * @typedef {Object} TunnelConfig
 * @property {string} id
 * @property {string} machineId
 * @property {'local'|'reverse'} direction
 * @property {number} localPort
 * @property {string} remoteHost
 * @property {number} remotePort
 * @property {boolean} active
 */
