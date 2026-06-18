export {};

declare global {
  interface ArrShape {
    car<T>(xs: ArrList<T>): T;
  }
}
