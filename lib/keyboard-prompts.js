/**
 * Keyboard-interactive prompt registry (#173): extracted from SshService so
 * the connection service stays under the size budget.
 */
export class KeyboardPromptManager {
  constructor() {
    /** @type {Map<string, { view: any, finish: Function, timer: NodeJS.Timeout }>} */
    this.prompts = new Map();
  }

  begin(profileId, view, finish, timeoutMs = 60000) {
    const id = profileId || '';
    this.clear(id);
    const timer = setTimeout(() => {
      if (!this.prompts.has(id)) return;
      this.prompts.delete(id);
      try { finish([]); } catch { /* the attempt already ended */ }
    }, timeoutMs);
    timer.unref?.();
    this.prompts.set(id, { view, finish, timer });
  }

  list() {
    return [...this.prompts.entries()].map(([profileId, pending]) => ({
      profileId,
      instructions: pending.view.instructions,
      prompts: pending.view.prompts
    }));
  }

  submit(profileId, answers) {
    const pending = this.prompts.get(profileId || '');
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.prompts.delete(profileId || '');
    const values = Array.isArray(answers) ? answers.map((item) => String(item ?? '')) : [];
    pending.finish(values);
    return true;
  }

  clear(profileId) {
    const pending = this.prompts.get(profileId || '');
    if (!pending) return;
    clearTimeout(pending.timer);
    this.prompts.delete(profileId || '');
  }
}
