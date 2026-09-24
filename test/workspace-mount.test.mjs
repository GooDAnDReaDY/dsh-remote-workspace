import test from 'node:test';
import assert from 'node:assert/strict';
import { attachWorkspaceNode } from '../lib/workspace-mount.js';

test('the workspace node is moved back without being recreated', () => {
  const calls = [];
  const column = {
    appendChild(node) {
      calls.push(node);
      node.parentElement = column;
    }
  };
  const node = { parentElement: null, id: 'kept' };
  assert.equal(attachWorkspaceNode(column, node), true);
  assert.equal(attachWorkspaceNode(column, node), true);
  assert.equal(calls.length, 1);
  assert.equal(node.id, 'kept');
});
