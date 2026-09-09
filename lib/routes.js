export function registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store) {
  // Safe check without touching ctx.router directly if not present
  const router = ctx.get ? ctx.get('router') : ctx.router;
  if (!router || typeof router.get !== 'function') return;

  router.get('/api/remote-workspace/profiles', async (c) => {
    const profiles = store.getProfiles();
    return c.json({ profiles, activeId: store.getActiveId() });
  });

  router.post('/api/remote-workspace/profiles', async (c) => {
    const body = await c.req.json();
    store.saveProfile(body);
    return c.json({ success: true });
  });

  router.post('/api/remote-workspace/test', async (c) => {
    const profile = await c.req.json();
    try {
      const result = await sshService.testConnection(profile);
      return c.json(result);
    } catch (err) {
      return c.json({ success: false, error: err.message }, 400);
    }
  });

  router.post('/api/remote-workspace/browse', async (c) => {
    const { profileId, remotePath } = await c.req.json();
    const profile = store.getProfile(profileId);
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    try {
      const entries = await remoteFs.listDir(profile, remotePath || '/');
      return c.json({ entries });
    } catch (err) {
      return c.json({ error: err.message }, 500);
    }
  });

  router.get('/api/remote-workspace/tunnels', (c) => {
    return c.json({ tunnels: tunnelService.listActiveTunnels() });
  });
}
