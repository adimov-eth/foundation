function getOrCreateValue<K, V>(
  key: K,
  has: (key: K) => boolean,
  read: (key: K) => V | undefined,
  write: (key: K, value: V) => void,
  factory: (key: K) => V,
): V {
  if (!has(key)) {
    const value = factory(key);
    write(key, value);
    return value;
  }
  return read(key)!;
}

export class DefaultedMap<K, V> extends Map<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    return getOrCreateValue(
      key,
      (k) => super.has(k),
      (k) => super.get(k),
      (k, value) => {
        super.set(k, value);
      },
      this.factory,
    );
  }
}

export class DefaultedWeakMap<K extends object, V> extends WeakMap<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    if (!super.has(key)) super.set(key, this.factory(key));
    return super.get(key)!;
  }
}
