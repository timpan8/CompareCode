import type { Region } from './types'

/**
 * Slides pure insertions and deletions to the position a person would have picked.
 *
 * When a block of lines is added, there is often more than one place the diff could
 * legally put the boundary — all with the same number of changed lines, but not all
 * equally readable. The classic symptom is a diff that starts at the closing brace
 * of the previous function instead of at the blank line before the new one.
 *
 * The scoring model and its weights are those of git's indent heuristic
 * (`xdiff/xdiffi.c`, GPL-2.0), reimplemented here in TypeScript. They are worth
 * copying rather than inventing: they were tuned against a corpus of diffs that
 * humans had rated by hand.
 */

const MAX_INDENT = 200
const MAX_BLANKS = 20

const START_OF_FILE_PENALTY = 1
const END_OF_FILE_PENALTY = 21
const TOTAL_BLANK_WEIGHT = -30
const POST_BLANK_WEIGHT = 6
const RELATIVE_INDENT_PENALTY = -4
const RELATIVE_INDENT_WITH_BLANK_PENALTY = 10
const RELATIVE_OUTDENT_PENALTY = 24
const RELATIVE_OUTDENT_WITH_BLANK_PENALTY = 17
const RELATIVE_DEDENT_PENALTY = 23
const RELATIVE_DEDENT_WITH_BLANK_PENALTY = 17
const INDENT_WEIGHT = 60

/** Scoring every position of a very long slide is not worth the time it takes. */
const MAX_SLIDING = 100

interface SplitMeasurement {
  endOfFile: boolean
  indent: number
  preBlank: number
  preIndent: number
  postBlank: number
  postIndent: number
}

interface SplitScore {
  effectiveIndent: number
  penalty: number
}

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\v' || char === '\f' || char === '\r'
}

/** Visual indentation of a line, or -1 when the line is blank. Tabs advance to 8. */
export function getIndent(line: string): number {
  let indent = 0

  for (let i = 0; i < line.length; i++) {
    const char = line[i] as string
    if (!isSpace(char)) return indent

    if (char === ' ') indent += 1
    else if (char === '\t') indent += 8 - (indent % 8)
    // Other whitespace does not move the cursor in any useful sense.

    if (indent >= MAX_INDENT) return MAX_INDENT
  }
  return -1
}

/** Describes the neighbourhood of a boundary that sits just before line `split`. */
function measureSplit(lines: readonly string[], split: number): SplitMeasurement {
  const measurement: SplitMeasurement = {
    endOfFile: split >= lines.length,
    indent: split >= lines.length ? -1 : getIndent(lines[split] as string),
    preBlank: 0,
    preIndent: -1,
    postBlank: 0,
    postIndent: -1,
  }

  for (let i = split - 1; i >= 0; i--) {
    measurement.preIndent = getIndent(lines[i] as string)
    if (measurement.preIndent !== -1) break
    measurement.preBlank += 1
    if (measurement.preBlank === MAX_BLANKS) {
      measurement.preIndent = 0
      break
    }
  }

  for (let i = split + 1; i < lines.length; i++) {
    measurement.postIndent = getIndent(lines[i] as string)
    if (measurement.postIndent !== -1) break
    measurement.postBlank += 1
    if (measurement.postBlank === MAX_BLANKS) {
      measurement.postIndent = 0
      break
    }
  }

  return measurement
}

function scoreAddSplit(measurement: SplitMeasurement, score: SplitScore): void {
  if (measurement.preIndent === -1 && measurement.preBlank === 0) {
    score.penalty += START_OF_FILE_PENALTY
  }
  if (measurement.endOfFile) {
    score.penalty += END_OF_FILE_PENALTY
  }

  const postBlank = measurement.indent === -1 ? 1 + measurement.postBlank : 0
  const totalBlank = measurement.preBlank + postBlank

  score.penalty += TOTAL_BLANK_WEIGHT * totalBlank
  score.penalty += POST_BLANK_WEIGHT * postBlank

  const indent = measurement.indent !== -1 ? measurement.indent : measurement.postIndent
  const anyBlanks = totalBlank !== 0

  score.effectiveIndent += indent

  if (indent === -1 || measurement.preIndent === -1 || indent === measurement.preIndent) {
    // Nothing more to say about this boundary.
  } else if (indent > measurement.preIndent) {
    score.penalty += anyBlanks ? RELATIVE_INDENT_WITH_BLANK_PENALTY : RELATIVE_INDENT_PENALTY
  } else if (measurement.postIndent !== -1 && measurement.postIndent > indent) {
    score.penalty += anyBlanks ? RELATIVE_OUTDENT_WITH_BLANK_PENALTY : RELATIVE_OUTDENT_PENALTY
  } else {
    score.penalty += anyBlanks ? RELATIVE_DEDENT_WITH_BLANK_PENALTY : RELATIVE_DEDENT_PENALTY
  }
}

/** Negative when the first score is the better (lower) one. */
function scoreCompare(first: SplitScore, second: SplitScore): number {
  const indentComparison =
    (first.effectiveIndent > second.effectiveIndent ? 1 : 0) -
    (first.effectiveIndent < second.effectiveIndent ? 1 : 0)

  return INDENT_WEIGHT * indentComparison + (first.penalty - second.penalty)
}

/**
 * Shifts each single-sided region to its best-scoring position, in place.
 * Regions that change both sides have no freedom to move and are left alone.
 */
export function compactRegions(
  regions: Region[],
  aKeys: Int32Array,
  bKeys: Int32Array,
  aLines: readonly string[],
  bLines: readonly string[],
): void {
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i] as Region
    const isInsertion = region.aStart === region.aEnd
    const isDeletion = region.bStart === region.bEnd
    if (isInsertion === isDeletion) continue

    const keys = isInsertion ? bKeys : aKeys
    const lines = isInsertion ? bLines : aLines
    const groupStart = isInsertion ? region.bStart : region.aStart
    const groupEnd = isInsertion ? region.bEnd : region.aEnd

    // Never slide into a neighbouring change; that would reorder the diff.
    const previous = regions[i - 1]
    const next = regions[i + 1]
    const minShift = Math.max(
      (previous ? previous.aEnd : 0) - region.aStart,
      (previous ? previous.bEnd : 0) - region.bStart,
    )
    const maxShift = Math.min(
      (next ? next.aStart : aKeys.length) - region.aEnd,
      (next ? next.bStart : bKeys.length) - region.bEnd,
    )

    let earliest = 0
    while (earliest > minShift && keys[groupStart + earliest - 1] === keys[groupEnd + earliest - 1]) {
      earliest--
    }
    let latest = 0
    while (latest < maxShift && keys[groupStart + latest] === keys[groupEnd + latest]) {
      latest++
    }

    if (earliest === latest) continue
    if (latest - earliest > MAX_SLIDING) earliest = latest - MAX_SLIDING

    let bestShift = earliest
    let bestScore: SplitScore | null = null

    for (let shift = earliest; shift <= latest; shift++) {
      const score: SplitScore = { effectiveIndent: 0, penalty: 0 }
      scoreAddSplit(measureSplit(lines, groupEnd + shift), score)
      scoreAddSplit(measureSplit(lines, groupStart + shift), score)

      // On a tie the later position wins, matching git: a block reads better
      // attached to what follows it than to what precedes it.
      if (bestScore === null || scoreCompare(score, bestScore) <= 0) {
        bestScore = score
        bestShift = shift
      }
    }

    if (bestShift !== 0) {
      region.aStart += bestShift
      region.aEnd += bestShift
      region.bStart += bestShift
      region.bEnd += bestShift
    }
  }
}
