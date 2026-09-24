import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';

test('a terminal uses its own connection and closes it', async () => {
  const service = new SshService({});
  let ended = 0;
  let pooled = 0;
  service.getConnection = async () => { pooled += 1; throw new Error('pooled'); };
  service.connectDedicated = async () => ({
    end() { ended += 1; },
    shell(_opts, cb) {
      const stream = {
        write() {},
        end() {},
        setWindow() {},
        on(event, fn) {
          if (event === 'close') stream.closeFn = fn;
        }
      };
      cb(null, stream);
    }
  });
  const session = await service.createTerminalSession({ id: 'host' }, { cols: 80, rows: 24 });
  assert.equal(pooled, 0);
  session.close();
  assert.equal(ended, 1);
  session.close();
  assert.equal(ended, 1);
});
