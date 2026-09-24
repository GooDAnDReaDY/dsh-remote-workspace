export function shouldPoll({ hidden = false, inFlight = false } = {}) {
  if (hidden) return false;
  if (inFlight) return false;
  return true;
}
