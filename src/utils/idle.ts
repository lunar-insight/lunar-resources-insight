/**
 * Runs a callback once the browser is idle, or on the next task where it has
 * no idle callback. Returns a function that cancels it.
 */
export function runWhenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(callback);
  return () => clearTimeout(timer);
}
