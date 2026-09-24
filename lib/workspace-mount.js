export function attachWorkspaceNode(column, node) {
  if (!column || !node || typeof column.appendChild !== 'function') return false;
  if (node.parentElement !== column) column.appendChild(node);
  return node.parentElement === column;
}
