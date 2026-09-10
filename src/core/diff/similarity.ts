import { internLines, normalizeLine, splitLines } from './lines'
import { DEFAULT_DIFF_OPTIONS } from './options'
import type { DiffOptions } from './types'

/**
 * A cheap summary of a document, for comparing many of them at once.
 *
 * Nothing in the app uses this yet. It exists because the N-way tool — "which of
 * these five files are the same, and how alike are the rest?" — should not need
 * to run a full diff for every pair: identical documents fall out of the hash in
 * one pass, and the rest can be ranked by shingle overlap before anyone asks for
 * a real comparison.
 */
export interface Fingerprint {
  /** Equal hashes mean identical content under the given options. */
  hash: string
  /** Sorted, de-duplicated hashes of overlapping line windows. */
  shingles: Uint32Array
}

const SHINGLE_SIZE = 3

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function fingerprint(text: string, overrides?: Partial<DiffOptions>): Fingerprint {
  const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ...overrides }
  const lines = splitLines(text).map((line) => normalizeLine(line, options))
  const kept = options.ignoreBlankLines ? lines.filter((line) => line.trim() !== '') : lines

  const seen = new Set<number>()
  if (kept.length < SHINGLE_SIZE) {
    if (kept.length > 0) seen.add(fnv1a(kept.join('\n')))
  } else {
    for (let i = 0; i <= kept.length - SHINGLE_SIZE; i++) {
      seen.add(fnv1a(kept.slice(i, i + SHINGLE_SIZE).join('\n')))
    }
  }

  const shingles = Uint32Array.from(seen)
  shingles.sort()

  return { hash: fnv1a(kept.join('\n')).toString(16), shingles }
}

/** Overlap between two fingerprints, 0–1. Fast enough to fill an N×N matrix. */
export function jaccard(first: Fingerprint, second: Fingerprint): number {
  const a = first.shingles
  const b = second.shingles
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  let i = 0
  let j = 0
  let shared = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      shared++
      i++
      j++
    } else if (a[i] < b[j]) {
      i++
    } else {
      j++
    }
  }

  return shared / (a.length + b.length - shared)
}

/**
 * Share of lines the two documents have in common, ignoring order-independent
 * detail. Cheaper than a full diff and enough to rank candidates.
 */
export function lineOverlap(
  aText: string,
  bText: string,
  overrides?: Partial<DiffOptions>,
): number {
  const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ...overrides }
  const table = new Map<string, number>()
  const aKeys = internLines(splitLines(aText), table, options)
  const bKeys = internLines(splitLines(bText), table, options)
  if (aKeys.length === 0 && bKeys.length === 0) return 1

  const counts = new Map<number, number>()
  for (const key of aKeys) counts.set(key, (counts.get(key) ?? 0) + 1)

  let shared = 0
  for (const key of bKeys) {
    const remaining = counts.get(key) ?? 0
    if (remaining > 0) {
      counts.set(key, remaining - 1)
      shared++
    }
  }

  return (2 * shared) / (aKeys.length + bKeys.length)
}
