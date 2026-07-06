/** Minimal observable store. Subscribers run synchronously on set/update. */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (cur: T) => T): void;
  subscribe(fn: (value: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const fn of [...subs]) fn(value);
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      fn(value);
      return () => subs.delete(fn);
    },
  };
}
