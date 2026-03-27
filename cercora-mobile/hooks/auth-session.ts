type SessionExpiredListener = () => void | Promise<void>;

const listeners = new Set<SessionExpiredListener>();
let lastNotifiedAt = 0;

export function notifySessionExpired() {
  const now = Date.now();
  if (now - lastNotifiedAt < 1_000) {
    return;
  }

  lastNotifiedAt = now;

  for (const listener of listeners) {
    void listener();
  }
}

export function subscribeToSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
