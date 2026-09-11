import { myersDiff } from './myers'
import type { Region } from './types'

/**
 * Histogram diff — the algorithm git uses for `diff.algorithm=histogram`, and the
 * right one for code.
 *
 * Plain Myers minimises the number of changed lines, which sounds ideal until you
 * feed it source code: it happily pairs the *wrong* closing brace and lays hunk
 * boundaries through the middle of a block. Patience fixes that by anchoring only
 * on lines that are unique on both sides, but gives up when nothing is unique —
 * which is most of a file full of `}`, `end` and `return`.
 *
 * Histogram generalises patience: it anchors on the common run whose rarest line
 * occurs fewest times, so it still finds a sensible anchor when nothing is unique,
 * and only falls back to Myers when there is genuinely nothing to hold on to.
 */

/** How many positions of one line value we are willing to try as anchors. */
const MAX_CHAIN_LENGTH = 64

interface Anchor {
  aStart: number
  bStart: number
  length: number
  rarity: number
}

export function histogramDiff(
  a: Int32Array,
  aLo: number,
  aHi: number,
  b: Int32Array,
  bLo: number,
  bHi: number,
  out: Region[],
): void {
  let lo = aLo
  let hi = aHi
  let bStart = bLo
  let bEnd = bHi

  // Equal ends are never interesting; peel them off before doing any work.
  while (lo < hi && bStart < bEnd && a[lo] === b[bStart]) {
    lo++
    bStart++
  }
  while (lo < hi && bStart < bEnd && a[hi - 1] === b[bEnd - 1]) {
    hi--
    bEnd--
  }

  if (lo === hi && bStart === bEnd) return
  if (lo === hi || bStart === bEnd) {
    out.push({ aStart: lo, aEnd: hi, bStart, bEnd })
    return
  }

  const anchor = findAnchor(a, lo, hi, b, bStart, bEnd)
  if (anchor === null) {
    myersDiff(a, lo, hi, b, bStart, bEnd, out)
    return
  }

  histogramDiff(a, lo, anchor.aStart, b, bStart, anchor.bStart, out)
  histogramDiff(
    a,
    anchor.aStart + anchor.length,
    hi,
    b,
    anchor.bStart + anchor.length,
    bEnd,
    out,
  )
}

/**
 * Finds the common run to split on: the one whose rarest line occurs fewest times
 * in A, breaking ties by length. Returns null when no line of B appears in A at
 * all, which sends the range to Myers.
 */
function findAnchor(
  a: Int32Array,
  aLo: number,
  aHi: number,
  b: Int32Array,
  bLo: number,
  bHi: number,
): Anchor | null {
  const counts = new Map<number, number>()
  const chains = new Map<number, number[]>()

  for (let i = aLo; i < aHi; i++) {
    const key = a[i]
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)

    // Very common lines get a bounded chain: trying every `}` in a large file
    // would be quadratic, and none of them is a good anchor anyway.
    if (count <= MAX_CHAIN_LENGTH) {
      const chain = chains.get(key)
      if (chain === undefined) chains.set(key, [i])
      else chain.push(i)
    }
  }

  let best: Anchor | null = null
  let bIndex = bLo

  while (bIndex < bHi) {
    const chain = chains.get(b[bIndex])
    let nextIndex = bIndex + 1

    if (chain !== undefined) {
      for (const candidate of chain) {
        let rarity = counts.get(a[candidate]) as number

        let runAStart = candidate
        let runBStart = bIndex
        while (runAStart > aLo && runBStart > bLo && a[runAStart - 1] === b[runBStart - 1]) {
          runAStart--
          runBStart--
          const count = counts.get(a[runAStart]) as number
          if (count < rarity) rarity = count
        }

        let runAEnd = candidate + 1
        let runBEnd = bIndex + 1
        while (runAEnd < aHi && runBEnd < bHi && a[runAEnd] === b[runBEnd]) {
          const count = counts.get(a[runAEnd]) as number
          if (count < rarity) rarity = count
          runAEnd++
          runBEnd++
        }

        const length = runAEnd - runAStart
        if (best === null || rarity < best.rarity || (rarity === best.rarity && length > best.length)) {
          best = { aStart: runAStart, bStart: runBStart, length, rarity }
        }

        // Nothing after this run on the B side can start a longer match here.
        if (runBEnd > nextIndex) nextIndex = runBEnd
      }
    }

    bIndex = nextIndex
  }

  return best
}
