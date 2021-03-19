/**
 * [1,2,3] ∪ [3,4,5] => Set([1,2,3,4,5])
 * @param {Array<T>} a first array
 * @param {Array<T>} b second array
 * @returns {Set<T>} elements in either array
 */
export function setUnion<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#union-a-b
  return new Set([...a, ...b])
}

/**
 * [1,2,3] ∩ [3,4,5] => Set([3])
 * @param {Array<T>} a first array
 * @param {Array<T>} b second array
 * @returns {Set<T>} elements that are in both arrays
 */
export function setIntersect<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#intersection-a-b
  // ensure shortest array is first
  if (b.length < a.length) [a, b] = [b, a]
  const smallSet = new Set(a)
  return new Set(b.filter(x => smallSet.has(x)))
}

/**
 * [1,2,3] \ [3,4,5] => Set([1,2])
 * @param {Array<T>} a first array
 * @param {Array<T>} b second array
 * @returns {Set<T>} elements in the first array but not the second
 */
export function setDifference<T>(a: Array<T>, b: Array<T>): Set<T> {
  // https://exploringjs.com/impatient-js/ch_sets.html#difference-a-b
  const bSet = new Set(b)
  return new Set(a.filter(x => !bSet.has(x)))
}

/**
 * type guarding filter to drop non-items from iterables
 *
 * @example
 * let a = [3, null, 2, undefined, 1, 0]
 * let b: number[] = a.filter(isDefined)  // [3, 2, 1, 0]
 * @param {T} t possibly defined object
 * @returns {boolean} true if t is not null or undefined
 */
export function isDefined<T>(t: T | null | undefined): t is T {
  return t !== undefined && t !== null
}
