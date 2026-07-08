// arith.d.ts — numeric builtins. All `SNum → SNum` (comparisons → SBool).
// `+ - * / < > <= >= = modulo quotient remainder min max` route through __arr
// (isBuiltin); `abs expt gcd lcm sqrt floor ceiling round truncate` are bare.

declare global {
  interface ArrShape {
    "+"(...xs: SNum[]): SNum;
    "-"(...xs: SNum[]): SNum;
    "*"(...xs: SNum[]): SNum;
    "/"(...xs: SNum[]): SNum;
    "<"(...xs: SNum[]): SBool;
    ">"(...xs: SNum[]): SBool;
    "<="(...xs: SNum[]): SBool;
    ">="(...xs: SNum[]): SBool;
    "="(...xs: SNum[]): SBool;
    modulo(a: SNum, b: SNum): SNum;
    quotient(a: SNum, b: SNum): SNum;
    remainder(a: SNum, b: SNum): SNum;
    min(...xs: SNum[]): SNum;
    max(...xs: SNum[]): SNum;
  }
  function abs(x: SNum): SNum;
  function expt(base: SNum, power: SNum): SNum;
  function gcd(...xs: SNum[]): SNum;
  function lcm(...xs: SNum[]): SNum;
  function sqrt(x: SNum): SNum;
  function floor(x: SNum): SNum;
  function ceiling(x: SNum): SNum;
  function round(x: SNum): SNum;
  function truncate(x: SNum): SNum;
}

export {};
