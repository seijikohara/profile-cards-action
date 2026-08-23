/** Immutable integer sequences for index-free iteration. */

/** [start, start + 1, …, start + length - 1]; empty when length <= 0. */
export function range(length: number, start = 0): readonly number[] {
  return Array.from({ length: Math.max(0, length) }, (_, index) => start + index);
}
