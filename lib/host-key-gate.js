import {
  HostKeyMismatchError,
  HostKeyUnknownError,
  computeHostKeyFingerprint
} from './host-key-store.js';

/**
 * Host key verification gate (#158, #173): TOFU via HostKeyStore, seeded from
 * OpenSSH known_hosts; mismatching keys are always rejected. Unknown keys are
 * only accepted when the profile explicitly opts in with `acceptUnknownHostKey`.
 * Extracted from SshService so the connection service stays under the size
 * budget; the store and the diagnostics map stay owned by the service.
 */
export class HostKeyGate {
  /**
   * @param {{ getStore: () => import('./host-key-store.js').HostKeyStore, info: Map<string, any> }} deps
   */
  constructor({ getStore, info }) {
    this.getStore = getStore;
    this.info = info;
  }

  verify(profile, hostKey) {
    const host = profile && profile.host;
    if (!host) {
      return null;
    }
    const port = profile.port || 22;
    const { fingerprint, algorithm } = computeHostKeyFingerprint(hostKey);
    const store = this.getStore();

    const stored = store.lookup(host, port);
    if (stored && stored.fingerprint !== fingerprint) {
      throw new HostKeyMismatchError(
        `Host key mismatch for ${host}:${port}: expected ${stored.fingerprint}, got ${fingerprint}. ` +
        'The connection was rejected: the server key changed or the traffic is being intercepted (MITM). ' +
        'If the change is expected, remove the stored key from the plugin known-hosts store and reconnect.',
        { host, port, expected: stored.fingerprint, got: fingerprint, algorithm }
      );
    }
    if (stored) {
      return { host, port, fingerprint, algorithm, status: 'known' };
    }

    const system = store.lookupSystemKnownHosts(host, port, profile.knownHostsFile);
    if (system && system.fingerprint !== fingerprint) {
      throw new HostKeyMismatchError(
        `Host key mismatch for ${host}:${port}: known_hosts (${system.source}) has ${system.fingerprint}, got ${fingerprint}. ` +
        'The connection was rejected: the server key changed or the traffic is being intercepted (MITM).',
        { host, port, expected: system.fingerprint, got: fingerprint, algorithm }
      );
    }
    if (system) {
      store.record(host, port, fingerprint, algorithm, 'known-hosts');
      return { host, port, fingerprint, algorithm, status: 'known-hosts' };
    }

    if (profile.acceptUnknownHostKey === true) {
      store.record(host, port, fingerprint, algorithm, 'tofu');
      return { host, port, fingerprint, algorithm, status: 'tofu' };
    }

    throw new HostKeyUnknownError(
      `Host key for ${host}:${port} is not trusted yet. Presented key: ${algorithm} ${fingerprint}. ` +
      'Verify the fingerprint out-of-band and set acceptUnknownHostKey: true on the profile to trust it on first use (TOFU).',
      { host, port, fingerprint, algorithm }
    );
  }

  get(profileId) {
    return this.info.get(profileId) || null;
  }

  verifier(profile, connId) {
    return (hostKey, verifyCb) => {
      let info = null;
      try {
        info = this.verify(profile, hostKey);
        verifyCb();
      } catch (err) {
        info = {
          host: profile.host,
          port: profile.port || 22,
          fingerprint: (err.details && err.details.got) || '',
          algorithm: (err.details && err.details.algorithm) || '',
          status: err.code || 'rejected',
          error: err.message
        };
        verifyCb(err);
      }
      if (info) {
        this.info.set(connId, info);
      }
    };
  }
}
