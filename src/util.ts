type ValueOf<T> = T[keyof T]
type KeyOf<T> = keyof T

type PredicateFn<T> = (k: KeyOf<T>) => boolean
type KeyFn<T> = (v: ValueOf<T>) => KeyOf<T>

/**
 * type guarding filter to drop non-items from iterables
 *
 * @example
 * let a = [3, null, 2, undefined, 1, 0]
 * let b: number[] = a.filter(isDefined)  // [3, 2, 1, 0]
 */
export function isDefined<T>(t: T | null | undefined): t is T {
  return t !== undefined && t !== null
}

/**
 * construct a new object from an array of values, indexed by a given function.
 * index([0,1,2], (n)=>`hi.${n}`) => {'hi.0':0, 'hi.1':1, 'hi.2':2}
 */
export function index<T>(values: ValueOf<T>[], id: KeyFn<T>): T {
  const entries = values.map((v) => [id(v), v])
  return Object.fromEntries(entries)
}

export function valuesByKeyPred<T>(o: T, pred: PredicateFn<T>): ValueOf<T>[] {
  return Object.entries(o)
    .filter(([k]) => pred(k as KeyOf<T>))
    .map(([, v]) => v)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function alwaysTrue<T>(t: T): true {
  return true
}
