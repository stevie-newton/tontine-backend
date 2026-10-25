type ErrorListener = (message: string | null) => void;

const listeners = new Set<ErrorListener>();

export function emitGlobalError(message: string) {
  for (const listener of listeners) {
    listener(message);
  }
}

export function clearGlobalError() {
  for (const listener of listeners) {
    listener(null);
  }
}

export function subscribeToGlobalError(listener: ErrorListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
