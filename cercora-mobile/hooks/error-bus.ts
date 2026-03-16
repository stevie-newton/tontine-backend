type ErrorListener = (message: string) => void;

const listeners = new Set<ErrorListener>();

export function emitGlobalError(message: string) {
  for (const listener of listeners) {
    listener(message);
  }
}

export function subscribeToGlobalError(listener: ErrorListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
