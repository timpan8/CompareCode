import { histogramDiff } from './histogram'
import { diffTokens, pairChangedLines } from './intraline'
import { internLines, isBlank, splitLines } from './lines'
import { myersDiff } from './myers'
import { DEFAULT_DIFF_OPTIONS } from './options'
import { compactRegions } from './slider'
import { bigramSimilarity } from './tokens'
import type { DiffLine, DiffOptions, DiffResult, DiffStats, Hunk, Region } from './types'

export type {
  DiffLine,
  DiffOptions,
  DiffResult,
  DiffStats,
  Hunk,
  LineOp,
  Region,
  TokenSpan,
  WordDiff,
} from './types'
export { splitLines, isBlank, normalizeLine } from './lines'
export { fingerprint, jaccard, lineOverlap, type Fingerprint } from './similarity'
export { DEFAULT_DIFF_OPTIONS } from './options'

/** How long a line may be before it is too expensive to score for similarity. */
const MAX_SIMILARITY_LENGTH = 2000

export function diffText(
  aText: string,
  bText: string,
  overrides?: Partial<DiffOptions>,
): DiffResult {
  return diffLineArrays(splitLines(aText), splitLines(bText), overrides)
}

/** How alike two documents are, 0–1. Exactly 1 only when they are identical. */
export function similarity(
  aText: string,
  bText: string,
  overrides?: Partial<DiffOptions>,
): number {
  return diffText(aText, bText, { ...overrides, intraLine: false }).stats.similarity
}

export function diffLineArrays(
  aLines: readonly string[],
  bLines: readonly string[],
  overrides?: Partial<DiffOptions>,
): DiffResult {
  const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ...overrides }
  const deadline = Date.now() + options.timeBudgetMs

  const table = new Map<string, number>()
  const aKeys = internLines(aLines, table, options)
  const bKeys = internLines(bLines, table, options)

  // Blank lines are diffed out of a filtered copy and mapped back afterwards, so
  // the line numbers on screen stay the real ones.
  const aView = options.ignoreBlankLines ? filterBlanks(aLines, aKeys) : null
  const bView = options.ignoreBlankLines ? filterBlanks(bLines, bKeys) : null
  const aWorkKeys = aView?.keys ?? aKeys
  const bWorkKeys = bView?.keys ?? bKeys
  const aWorkTexts = aView?.texts ?? aLines
  const bWorkTexts = bView?.texts ?? bLines

  const regions: Region[] = []
  if (options.algorithm === 'myers') {
    myersDiff(aWorkKeys, 0, aWorkKeys.length, bWorkKeys, 0, bWorkKeys.length, regions)
  } else {
    histogramDiff(aWorkKeys, 0, aWorkKeys.length, bWorkKeys, 0, bWorkKeys.length, regions)
  }
  compactRegions(regions, aWorkKeys, bWorkKeys, aWorkTexts, bWorkTexts)

  const mapped = aView && bView ? regions.map((r) => mapRegion(r, aView, bView, aLines.length, bLines.length)) : regions

  const builder = new RowBuilder(aLines, bLines, options, deadline)
  let aPos = 0
  let bPos = 0
  for (const region of mapped) {
    builder.equalRun(aPos, region.aStart, bPos, region.bStart)
    builder.change(region)
    aPos = region.aEnd
    bPos = region.bEnd
  }
  builder.equalRun(aPos, aLines.length, bPos, bLines.length)

  const lines = builder.lines
  return {
    lines,
    hunks: buildHunks(lines),
    stats: buildStats(lines, aLines.length, bLines.length),
    truncated: builder.truncated,
  }
}

interface FilteredView {
  keys: Int32Array
  texts: string[]
  /** Original index of each kept line. */
  map: Int32Array
}

function filterBlanks(lines: readonly string[], keys: Int32Array): FilteredView {
  const kept: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!isBlank(lines[i] as string)) kept.push(i)
  }

  const filteredKeys = new Int32Array(kept.length)
  const texts = new Array<string>(kept.length)
  const map = new Int32Array(kept.length)

  for (let i = 0; i < kept.length; i++) {
    const original = kept[i] as number
    filteredKeys[i] = keys[original]
    texts[i] = lines[original] as string
    map[i] = original
  }
  return { keys: filteredKeys, texts, map }
}

function mapRegion(
  region: Region,
  aView: FilteredView,
  bView: FilteredView,
  aLength: number,
  bLength: number,
): Region {
  const start = (view: FilteredView, index: number, length: number): number =>
    index < view.map.length ? view.map[index] : length
  const end = (view: FilteredView, from: number, to: number, length: number): number =>
    to <= from ? start(view, to, length) : view.map[to - 1] + 1

  return {
    aStart: start(aView, region.aStart, aLength),
    aEnd: end(aView, region.aStart, region.aEnd, aLength),
    bStart: start(bView, region.bStart, bLength),
    bEnd: end(bView, region.bStart, region.bEnd, bLength),
  }
}

/** Turns regions into the row model the side-by-side view renders directly. */
class RowBuilder {
  readonly lines: DiffLine[] = []
  truncated = false

  constructor(
    private readonly aLines: readonly string[],
    private readonly bLines: readonly string[],
    private readonly options: DiffOptions,
    private readonly deadline: number,
  ) {}

  equalRun(aFrom: number, aTo: number, bFrom: number, bTo: number): void {
    let i = aFrom
    let j = bFrom

    while (i < aTo && j < bTo) {
      // With blank lines ignored the two sides of an "equal" stretch can hold a
      // different number of lines; the surplus blanks become filler rows.
      const aFiller = this.options.ignoreBlankLines && isBlank(this.aLines[i] as string)
      const bFiller = this.options.ignoreBlankLines && isBlank(this.bLines[j] as string)

      if (aFiller && !bFiller) {
        this.pushFiller(i++, null)
      } else if (bFiller && !aFiller) {
        this.pushFiller(null, j++)
      } else {
        this.push({
          op: 'equal',
          aIndex: i,
          bIndex: j,
          aText: this.aLines[i] as string,
          bText: this.bLines[j] as string,
          words: null,
          whitespaceOnly: false,
          filler: false,
        })
        i++
        j++
      }
    }
    while (i < aTo) this.pushFiller(i++, null)
    while (j < bTo) this.pushFiller(null, j++)
  }

  change(region: Region): void {
    const aTexts = this.aLines.slice(region.aStart, region.aEnd)
    const bTexts = this.bLines.slice(region.bStart, region.bEnd)
    const pairs = pairChangedLines(aTexts, bTexts, this.options)

    let i = region.aStart
    let j = region.bStart

    for (const [pairedA, pairedB] of pairs) {
      const aIndex = region.aStart + pairedA
      const bIndex = region.bStart + pairedB
      while (i < aIndex) this.pushSingle(i++, 'delete')
      while (j < bIndex) this.pushSingle(j++, 'insert')
      this.pushReplace(aIndex, bIndex)
      i = aIndex + 1
      j = bIndex + 1
    }
    while (i < region.aEnd) this.pushSingle(i++, 'delete')
    while (j < region.bEnd) this.pushSingle(j++, 'insert')
  }

  private pushReplace(aIndex: number, bIndex: number): void {
    const aText = this.aLines[aIndex] as string
    const bText = this.bLines[bIndex] as string

    let words = null
    if (this.options.intraLine) {
      if (Date.now() > this.deadline) this.truncated = true
      else words = diffTokens(aText, bText, this.options)
    }

    this.push({
      op: 'replace',
      aIndex,
      bIndex,
      aText,
      bText,
      words,
      whitespaceOnly: stripWhitespace(aText) === stripWhitespace(bText),
      filler: false,
    })
  }

  private pushSingle(index: number, op: 'delete' | 'insert'): void {
    const isDelete = op === 'delete'
    this.push({
      op,
      aIndex: isDelete ? index : null,
      bIndex: isDelete ? null : index,
      aText: isDelete ? (this.aLines[index] as string) : '',
      bText: isDelete ? '' : (this.bLines[index] as string),
      words: null,
      whitespaceOnly: false,
      filler: false,
    })
  }

  private pushFiller(aIndex: number | null, bIndex: number | null): void {
    this.push({
      op: 'equal',
      aIndex,
      bIndex,
      aText: aIndex === null ? '' : (this.aLines[aIndex] as string),
      bText: bIndex === null ? '' : (this.bLines[bIndex] as string),
      words: null,
      whitespaceOnly: false,
      filler: true,
    })
  }

  private push(line: DiffLine): void {
    this.lines.push(line)
  }
}

function stripWhitespace(text: string): string {
  return text.replace(/\s+/g, '')
}

function buildHunks(lines: readonly DiffLine[]): Hunk[] {
  const hunks: Hunk[] = []
  let index = 0

  while (index < lines.length) {
    if ((lines[index] as DiffLine).op === 'equal') {
      index++
      continue
    }

    const start = index
    while (index < lines.length && (lines[index] as DiffLine).op !== 'equal') index++

    let aStart = -1
    let bStart = -1
    let aCount = 0
    let bCount = 0
    for (let i = start; i < index; i++) {
      const line = lines[i] as DiffLine
      if (line.aIndex !== null) {
        if (aStart === -1) aStart = line.aIndex
        aCount++
      }
      if (line.bIndex !== null) {
        if (bStart === -1) bStart = line.bIndex
        bCount++
      }
    }

    hunks.push({
      start,
      end: index,
      aStart: aStart === -1 ? 0 : aStart,
      aCount,
      bStart: bStart === -1 ? 0 : bStart,
      bCount,
    })
  }

  return hunks
}

function buildStats(lines: readonly DiffLine[], aLength: number, bLength: number): DiffStats {
  let added = 0
  let removed = 0
  let changed = 0
  let unchanged = 0
  let matched = 0

  for (const line of lines) {
    switch (line.op) {
      case 'insert':
        added++
        break
      case 'delete':
        removed++
        break
      case 'replace': {
        changed++
        const scorable =
          line.aText.length <= MAX_SIMILARITY_LENGTH && line.bText.length <= MAX_SIMILARITY_LENGTH
        matched += 2 * (scorable ? bigramSimilarity(line.aText, line.bText) : 0)
        break
      }
      case 'equal':
        if (line.filler) {
          // One side has a blank line the other does not, and blank lines are
          // being ignored — not a difference, so it should not lower the score.
          matched += 1
        } else {
          unchanged++
          matched += 2
        }
        break
    }
  }

  const total = aLength + bLength
  return {
    added,
    removed,
    changed,
    unchanged,
    similarity: total === 0 ? 1 : Math.min(1, matched / total),
  }
}
