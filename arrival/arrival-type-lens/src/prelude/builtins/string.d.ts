// string.d.ts — string builtins in the SStr/SNum/Sym vocabulary.
// `string-append string=? string-ci=?` route through __arr (isBuiltin); the rest are
// bare (camelCased). The `=?` predicates are variadic string comparisons → SBool.

declare global {
  interface ArrShape {
    "string-append"(...xs: SStr[]): SStr;
    "string=?"(...xs: SStr[]): SBool;
    "string-ci=?"(...xs: SStr[]): SBool;
  }
  function stringLength(s: SStr): SNum;
  function substring(s: SStr, start: SNum, end?: SNum): SStr;
  function stringRef(s: SStr, k: SNum): Char;
  function stringToNumber(s: SStr): SNum;
  function numberToString(n: SNum): SStr;
  function stringToSymbol(s: SStr): Sym;
  function symbolToString(s: Sym): SStr;
  function stringToList(s: SStr): List<Char>;
  function listToString(xs: List<Char>): SStr;
  function stringSplit(s: SStr, sep: SStr): List<SStr>;
  function stringUpcase(s: SStr): SStr;
  function stringDowncase(s: SStr): SStr;
  function charToInteger(c: Char): SNum;
  function integerToChar(n: SNum): Char;
}

export {};
