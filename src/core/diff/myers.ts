import type { Region } from './types'

/**
 * Myers' O(ND) greedy diff, used as the fallback when the histogram pass finds
 * no usable anchor, and for the token-level diff inside a changed line pair.
 *
 * The search keeps a snapshot of the frontier per edit distance and walks it
 * back to recover the path. That costs O(D²) memory, which is why `maxEditDistance`
 * exists: past that point the two sides have so little in common that "everything
 * here was replaced" is both the honest answer and the readable one.
 */
export const DEFAULT_MAX_EDIT_DISTANCE = 1000

/**
 * Appends the change regions between a[aLo,aHi) and b[bLo,bHi) to `out`.
 * Returns false if the edit distance cap was hit and the whole range was emitted
 * as a single replacement.
 */
export function myersDiff(
  a: ArrayLike<number>,
  aLo: number,
  aHi: number,
  b: ArrayLike<number>,
  bLo: number,
  bHi: number,
  out: Region[],
  maxEditDistance: number = DEFAULT_MAX_EDIT_DISTANCE,
): boolean {
  const n = aHi - aLo
  const m = bHi - bLo

  if (n === 0 && m === 0) return true
  if (n === 0 || m === 0) {
    out.push({ aStart: aLo, aEnd: aHi, bStart: bLo, bEnd: bHi })
    return true
  }

  const max = Math.min(n + m, maxEditDistance)
  const offset = max
  const v = new Int32Array(2 * max + 2)
  const trace: Int32Array[] = []

  for (let d = 0; d <= max; d++) {
    // The frontier as it stands before this round; indexed by diagonal + d.
    trace.push(v.slice(offset - d, offset + d + 1))

    for (let k = -d; k <= d; k += 2) {
      const x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1] // came from above: a line was inserted
          : v[offset + k - 1] + 1 // came from the left: a line was deleted

      let px = x
      let py = x - k
      while (px < n && py < m && a[aLo + px] === b[bLo + py]) {
        px++
        py++
      }
      v[offset + k] = px

      if (px >= n && py >= m) {
        emitPath(trace, d, n, m, aLo, bLo, out)
        return true
      }
    }
  }

  out.push({ aStart: aLo, aEnd: aHi, bStart: bLo, bEnd: bHi })
  return false
}

/** Walks the recorded frontiers back from (n, m) and turns the path into regions. */
function emitPath(
  trace: Int32Array[],
  dEnd: number,
  n: number,
  m: number,
  aLo: number,
  bLo: number,
  out: Region[],
): void {
  // Flat triples of (aStart, bStart, length), collected end-to-start.
  const snakes: number[] = []
  let x = n
  let y = m

  for (let d = dEnd; d > 0; d--) {
    const previous = trace[d] as Int32Array
    const k = x - y
    const kPrev =
      k === -d || (k !== d && previous[k - 1 + d] < previous[k + 1 + d]) ? k + 1 : k - 1

    const prevX = previous[kPrev + d]
    const prevY = prevX - kPrev
    // One edit takes us from (prevX, prevY) to (stepX, stepY); the rest is a snake.
    const stepX = kPrev === k + 1 ? prevX : prevX + 1
    const stepY = stepX - k

    if (x > stepX) snakes.push(stepX, stepY, x - stepX)
    x = prevX
    y = prevY
  }
  if (x > 0) snakes.push(0, 0, x)

  let aPos = 0
  let bPos = 0
  for (let i = snakes.length - 3; i >= 0; i -= 3) {
    const sa = snakes[i] as number
    const sb = snakes[i + 1] as number
    const length = snakes[i + 2] as number

    if (sa > aPos || sb > bPos) {
      out.push({ aStart: aLo + aPos, aEnd: aLo + sa, bStart: bLo + bPos, bEnd: bLo + sb })
    }
    aPos = sa + length
    bPos = sb + length
  }
  if (aPos < n || bPos < m) {
    out.push({ aStart: aLo + aPos, aEnd: aLo + n, bStart: bLo + bPos, bEnd: bLo + m })
  }
}
