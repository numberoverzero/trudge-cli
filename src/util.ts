/**
 * [1,2,3] ∪ [3,4,5] => Set([1,2,3,4,5])
 */
export function setUnion<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#union-a-b
  return new Set([...a, ...b])
}

/**
 * [1,2,3] ∩ [3,4,5] => Set([3])
 */
export function setIntersection<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#intersection-a-b
  // ensure shortest array is first
  if (b.length < a.length) [a, b] = [b, a]
  const smallSet = new Set(a)
  return new Set(b.filter((x) => smallSet.has(x)))
}

/**
 * [1,2,3] \ [3,4,5] => Set([1,2])
 */
export function setDifference<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#difference-a-b
  const bSet = new Set(b)
  return new Set(a.filter((x) => !bSet.has(x)))
}

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
export function index<TKey extends string | number, TValue>(
  values: TValue[],
  id: (v: TValue) => TKey,
): { [K in TKey]: TValue } {
  const entries = values.map((v) => [id(v), v])
  return Object.fromEntries(entries)
}
