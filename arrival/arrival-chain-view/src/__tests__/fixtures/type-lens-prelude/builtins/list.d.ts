export {};

declare global {
  interface ArrShape {
    list<T extends readonly unknown[]>(...items: T): ArrList<T[number]>;
  }
}
