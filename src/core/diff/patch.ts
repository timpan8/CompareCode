import type { DiffLine, DiffResult } from './types'

/**
 * Renders the comparison as a unified patch — the format `git apply` and every
 * review tool understands. Handy for pasting a change somewhere else without
 * hand-copying it line by line.
 */
export function toUnifiedPatch(result: DiffResult, contextLines = 3): string {
  const lines = result.lines
  const groups = groupWithContext(lines, contextLines)
  if (groups.length === 0) return ''

  const out: string[] = ['--- old', '+++ new']

  for (const [from, to] of groups) {
    let aStart = 0
    let bStart = 0
    let aCount = 0
    let bCount = 0
    const body: string[] = []

    for (let i = from; i < to; i++) {
      const line = lines[i] as DiffLine
      if (line.aIndex !== null && aCount === 0) aStart = line.aIndex + 1
      if (line.bIndex !== null && bCount === 0) bStart = line.bIndex + 1

      switch (line.op) {
        case 'equal':
          if (line.filler) break
          body.push(` ${line.aText}`)
          aCount++
          bCount++
          break
        case 'delete':
          body.push(`-${line.aText}`)
          aCount++
          break
        case 'insert':
          body.push(`+${line.bText}`)
          bCount++
          break
        case 'replace':
          body.push(`-${line.aText}`)
          body.push(`+${line.bText}`)
          aCount++
          bCount++
          break
      }
    }

    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`)
    out.push(...body)
  }

  return `${out.join('\n')}\n`
}

/** Change blocks padded with context, merged when their padding overlaps. */
function groupWithContext(
  lines: readonly DiffLine[],
  contextLines: number,
): Array<[number, number]> {
  const groups: Array<[number, number]> = []

  for (const hunk of changeRuns(lines)) {
    const from = Math.max(0, hunk[0] - contextLines)
    const to = Math.min(lines.length, hunk[1] + contextLines)
    const previous = groups[groups.length - 1]

    if (previous !== undefined && from <= previous[1]) previous[1] = to
    else groups.push([from, to])
  }
  return groups
}

function changeRuns(lines: readonly DiffLine[]): Array<[number, number]> {
  const runs: Array<[number, number]> = []
  let index = 0

  while (index < lines.length) {
    if ((lines[index] as DiffLine).op === 'equal') {
      index++
      continue
    }
    const start = index
    while (index < lines.length && (lines[index] as DiffLine).op !== 'equal') index++
    runs.push([start, index])
  }
  return runs
}
