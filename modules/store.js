export function createStore(initialState = {}, { strict = true } = {}) {
  const listeners = new Set();
  let batchDepth = 0;
  let changed = false;
  const state = new Proxy({ ...initialState }, {
    set(target, key, value) {
      if (strict && !Reflect.has(target, key)) throw new Error(`Unknown state key: ${String(key)}`);
      if (Object.is(target[key], value)) return true;
      target[key] = value;
      changed = true;
      if (!batchDepth) publish();
      return true;
    },
  });
  function publish() {
    if (!changed) return;
    changed = false;
    listeners.forEach((listener) => listener(state));
  }
  function batch(operation) {
    batchDepth += 1;
    try { return operation(state); } finally { batchDepth -= 1; if (!batchDepth) publish(); }
  }
  return {
    state,
    batch,
    subscribe(listener, immediate = false) {
      listeners.add(listener);
      if (immediate) listener(state);
      return () => listeners.delete(listener);
    },
  };
}
