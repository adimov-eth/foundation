function getOrCreateValue<K, V>(map: Map<K, V> | WeakMap<K & object, V>, key: K, factory: (key: K) => V): V {
  const typedMap = map as Map<K, V>;
  const existing = typedMap.get(key);
  if (existing !== undefined || typedMap.has(key)) return existing as V;

  const created = factory(key);
  typedMap.set(key, created);
  return created;
}

export class DefaultedMap<K, V> extends Map<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    return getOrCreateValue(this, key, this.factory);
  }
}

export class DefaultedWeakMap<K extends object, V> extends WeakMap<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    return getOrCreateValue(this, key, this.factory);
  }
}
