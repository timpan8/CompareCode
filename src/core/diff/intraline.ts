import { myersDiff } from './myers'
import { bigramSimilarity, tokenize, type Token } from './tokens'
import type { DiffOptions, Region, TokenSpan, WordDiff } from './types'

/**
 * Word-level detail inside a change block.
 *
 * Two things make this readable rather than annoying. First, lines are paired by
 * similarity instead of by position — git's own `diff-highlight` gives up as soon
 * as the number of removed and added lines differs, which is the common case.
 * Second, the highlighting is dropped entirely when a line was rewritten rather
 * than edited: marking eighty per cent of a line is harder to read than marking
 * none of it.
 */

/** Pairs removed lines with added lines inside one change block, preserving order. */
export function pairChangedLines(
  aTexts: readonly string[],
  bTexts: readonly string[],
  options: DiffOptions,
): Array<[number, number]> {
  const aCount = aTexts.length
  const bCount = bTexts.length
  if (aCount === 0 || bCount === 0) return []

  // Equal counts almost always means line-for-line edits; don't overthink it.
  if (aCount === bCount || aCount * bCount > options.maxIntraLineComparisons) {
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < Math.min(aCount, bCount); i++) pairs.push([i, i])
    return pairs
  }

  const candidates: Array<{ a: number; b: number; score: number }> = []
  for (let i = 0; i < aCount; i++) {
    for (let j = 0; j < bCount; j++) {
      const score = bigramSimilarity(aTexts[i] as string, bTexts[j] as string)
      if (score >= options.intraLineMinSimilarity) candidates.push({ a: i, b: j, score })
    }
  }
  candidates.sort((first, second) => second.score - first.score)

  const accepted: Array<[number, number]> = []
  const usedA = new Set<number>()
  const usedB = new Set<number>()

  for (const candidate of candidates) {
    if (usedA.has(candidate.a) || usedB.has(candidate.b)) continue

    // Pairs may not cross: line 3 matching line 7 rules out line 5 matching line 2.
    const crosses = accepted.some(
      ([a, b]) => (candidate.a - a) * (candidate.b - b) < 0,
    )
    if (crosses) continue

    accepted.push([candidate.a, candidate.b])
    usedA.add(candidate.a)
    usedB.add(candidate.b)
  }

  accepted.sort((first, second) => first[0] - second[0])
  return accepted
}

/**
 * Marks which parts of a replaced line pair changed, or returns null when the two
 * lines are different enough that highlighting would just be noise.
 */
export function diffTokens(aText: string, bText: string, options: DiffOptions): WordDiff | null {
  if (aText === bText) return null
  if (aText.length > options.maxIntraLineLength || bText.length > options.maxIntraLineLength) {
    return null
  }
  if (aText.length === 0 || bText.length === 0) return null

  const aTokens = tokenize(aText)
  const bTokens = tokenize(bText)

  const table = new Map<string, number>()
  const aIds = internTokens(aText, aTokens, table)
  const bIds = internTokens(bText, bTokens, table)

  const regions: Region[] = []
  if (!myersDiff(aIds, 0, aIds.length, bIds, 0, bIds.length, regions)) return null

  const merged = mergeIncidentalMatches(regions, aTokens, bTokens)

  if (changedRatio(merged, aTokens, bTokens) > options.intraLineMaxChangedRatio) return null

  return {
    a: buildSpans(aText, aTokens, merged, 'a'),
    b: buildSpans(bText, bTokens, merged, 'b'),
  }
}

function internTokens(text: string, tokens: Token[], table: Map<string, number>): Int32Array {
  const ids = new Int32Array(tokens.length)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token
    const value = text.slice(token.start, token.end)
    let id = table.get(value)
    if (id === undefined) {
      id = table.size
      table.set(value, id)
    }
    ids[i] = id
  }
  return ids
}

/**
 * Absorbs short matches that only happen to line up, so a rewritten phrase reads
 * as one change instead of a scattering of them. This is the idea behind
 * diff-match-patch's semantic cleanup: an equal run surrounded by larger changes
 * on both sides is coincidence, not meaning.
 */
function mergeIncidentalMatches(
  regions: Region[],
  aTokens: Token[],
  bTokens: Token[],
): Region[] {
  if (regions.length < 2) return regions

  const textLength = (tokens: Token[], from: number, to: number): number => {
    if (to <= from) return 0
    return (tokens[to - 1] as Token).end - (tokens[from] as Token).start
  }
  const regionSize = (region: Region): number =>
    Math.max(
      textLength(aTokens, region.aStart, region.aEnd),
      textLength(bTokens, region.bStart, region.bEnd),
    )

  const merged: Region[] = [{ ...(regions[0] as Region) }]

  for (let i = 1; i < regions.length; i++) {
    const previous = merged[merged.length - 1] as Region
    const current = regions[i] as Region
    const gap = textLength(aTokens, previous.aEnd, current.aStart)

    if (gap > 0 && gap <= regionSize(previous) && gap <= regionSize(current)) {
      previous.aEnd = current.aEnd
      previous.bEnd = current.bEnd
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

function changedRatio(regions: Region[], aTokens: Token[], bTokens: Token[]): number {
  const countSignificant = (tokens: Token[], from: number, to: number): number => {
    let count = 0
    for (let i = from; i < to; i++) if (!(tokens[i] as Token).whitespace) count++
    return count
  }

  let changedA = 0
  let changedB = 0
  for (const region of regions) {
    changedA += countSignificant(aTokens, region.aStart, region.aEnd)
    changedB += countSignificant(bTokens, region.bStart, region.bEnd)
  }

  const totalA = countSignificant(aTokens, 0, aTokens.length)
  const totalB = countSignificant(bTokens, 0, bTokens.length)
  const total = Math.max(totalA, totalB)
  if (total === 0) return 0

  return Math.max(changedA, changedB) / total
}

/** Turns token-index regions into contiguous character spans over the original line. */
function buildSpans(
  text: string,
  tokens: Token[],
  regions: Region[],
  side: 'a' | 'b',
): TokenSpan[] {
  const changed = new Uint8Array(tokens.length)
  for (const region of regions) {
    const from = side === 'a' ? region.aStart : region.bStart
    const to = side === 'a' ? region.aEnd : region.bEnd
    for (let i = from; i < to; i++) changed[i] = 1
  }

  const spans: TokenSpan[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token
    const isChanged = changed[i] === 1
    const previous = spans[spans.length - 1]

    if (previous !== undefined && previous.changed === isChanged && previous.end === token.start) {
      previous.end = token.end
      previous.whitespace = previous.whitespace && token.whitespace
    } else {
      spans.push({ start: token.start, end: token.end, changed: isChanged, whitespace: token.whitespace })
    }
  }

  if (spans.length === 0 && text.length > 0) {
    spans.push({ start: 0, end: text.length, changed: true, whitespace: false })
  }
  return spans
}
