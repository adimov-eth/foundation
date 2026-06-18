import type * as mobx from "mobx";
import { computed, type IComputedValueOptions } from "mobx";

function getOrCreateComputed<K, V>(
  key: K,
  read: () => mobx.IComputedValue<V> | undefined,
  write: (value: mobx.IComputedValue<V>) => void,
  generator: (key: K) => V,
  options?: IComputedValueOptions<V>,
): V {
  const existing = read();
  if (existing !== undefined) return existing.get();

  const newValue = computed(() => generator(key), options);
  write(newValue);
  return newValue.get();
}

export class ComputedWeakMap<K extends WeakKey = WeakKey, V = any> extends WeakMap<K, V> {
  constructor(
    public readonly generator: (key: K) => V,
    public readonly options?: IComputedValueOptions<V>,
  ) {
    super();
  }

  get(key: K): V {
    const existing = super.get(key) as unknown as mobx.IComputedValue<V> | undefined;
    if (existing !== undefined) return existing.get();

    const newValue = computed(() => this.generator(key), this.options);
    super.set(key, newValue as unknown as V);
    return newValue.get();
  }
}

export class ComputedMap<K, V = any> extends Map<K, V> {
  constructor(
    public readonly generator: (key: K) => V,
    public readonly options?: IComputedValueOptions<V>,
  ) {
    super();
  }

  get(key: K): V {
    return getOrCreateComputed(
      key,
      () => super.get(key) as unknown as mobx.IComputedValue<V> | undefined,
      (value) => super.set(key, value as unknown as V),
      this.generator,
      this.options,
    );
  }
}

export class ComputedUniformMap<K = any, V = any> {
  private readonly weakMap = new WeakMap<WeakKey, mobx.IComputedValue<V>>();
  private readonly map = new Map<K, mobx.IComputedValue<V>>();

  constructor(
    public readonly generator: (key: K) => V,
    public readonly options?: IComputedValueOptions<V>,
  ) {}

  has(key: K): boolean {
    return this.isWeakKey(key) ? this.weakMap.has(key) : this.map.has(key);
  }

  get(key: K): V {
    if (this.has(key)) {
      const computedValue = this.isWeakKey(key) ? this.weakMap.get(key)! : this.map.get(key)!;
      return computedValue.get();
    }

    const newValue = computed(() => this.generator(key), this.options);
    if (this.isWeakKey(key)) {
      this.weakMap.set(key, newValue);
    } else {
      this.map.set(key, newValue);
    }
    return newValue.get();
  }

  delete(key: K): boolean {
    return this.isWeakKey(key) ? this.weakMap.delete(key) : this.map.delete(key);
  }

  private isWeakKey(key: K): key is K & WeakKey {
    return typeof key === "object" && key !== null;
  }
}
