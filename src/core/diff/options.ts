import type { DiffOptions } from './types'

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  ignoreLeadingWhitespace: false,
  ignoreTrailingWhitespace: false,
  ignoreAllWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  algorithm: 'histogram',
  intraLine: true,
  // Thresholds borrowed from diff2html, which has had far more real-world
  // exposure than anything we could have guessed at.
  intraLineMinSimilarity: 0.25,
  intraLineMaxChangedRatio: 0.5,
  maxIntraLineComparisons: 2500,
  maxIntraLineLength: 10000,
  timeBudgetMs: 1500,
}
