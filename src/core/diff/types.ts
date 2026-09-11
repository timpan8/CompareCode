/**
 * Shared shapes for the diff engine.
 *
 * Everything in `src/core` is pure: no DOM, no globals, no dependencies. That is
 * what lets the same engine back the two-way view today and a "differences only"
 * or N-way tool later without any of it being rewritten.
 */

/** A stretch of A that is replaced by a stretch of B. Everything outside is equal. */
export interface Region {
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
}

export type LineOp = 'equal' | 'insert' | 'delete' | 'replace'

/** A run of characters within a line, and whether this diff considers it changed. */
export interface TokenSpan {
  start: number
  end: number
  changed: boolean
  whitespace: boolean
}

/** Word-level detail for a replaced line pair, or `null` when it would be noise. */
export interface WordDiff {
  a: TokenSpan[]
  b: TokenSpan[]
}

/**
 * One row of the side-by-side view: at most one line from each side.
 *
 * `replace` rows carry both sides, which is what keeps the two columns aligned
 * inside a change block instead of letting them drift apart.
 */
export interface DiffLine {
  op: LineOp
  /** Zero-based index into the original lines of A, or null when A has no line here. */
  aIndex: number | null
  bIndex: number | null
  aText: string
  bText: string
  words: WordDiff | null
  /** The two sides differ only in whitespace. */
  whitespaceOnly: boolean
  /** A blank line that only one side has, skipped because blank lines are ignored. */
  filler: boolean
}

/** A contiguous block of changed rows, without surrounding context. */
export interface Hunk {
  /** Index range into `DiffResult.lines`. */
  start: number
  end: number
  aStart: number
  aCount: number
  bStart: number
  bCount: number
}

export interface DiffStats {
  added: number
  removed: number
  changed: number
  unchanged: number
  /** 0–1, symmetric, exactly 1 only for identical input. */
  similarity: number
}

export interface DiffOptions {
  ignoreLeadingWhitespace: boolean
  ignoreTrailingWhitespace: boolean
  ignoreAllWhitespace: boolean
  ignoreCase: boolean
  ignoreBlankLines: boolean
  algorithm: 'histogram' | 'myers'
  /** Highlight which words changed inside a replaced line pair. */
  intraLine: boolean
  /** Below this line-pair similarity, show a plain replace instead of word detail. */
  intraLineMinSimilarity: number
  /** Above this share of changed tokens, the highlighting is noise — drop it. */
  intraLineMaxChangedRatio: number
  /** Cap on line-pair comparisons when matching lines inside one change block. */
  maxIntraLineComparisons: number
  /** Lines longer than this never get word detail (minified code). */
  maxIntraLineLength: number
  /** Give up on word detail once the whole comparison has taken this long. */
  timeBudgetMs: number
}

export interface DiffResult {
  lines: DiffLine[]
  hunks: Hunk[]
  stats: DiffStats
  /** Word-level detail was skipped because the comparison ran out of time. */
  truncated: boolean
}
