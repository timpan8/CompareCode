import type { Hunk } from '../core/diff'

export interface RenderBlock {
  kind: 'lines' | 'fold'
  from: number
  to: number
}

/**
 * Decides which stretches of the diff to show and which to fold away.
 *
 * Every change keeps `contextLines` of unchanged code around it; longer runs of
 * untouched code become a single clickable line. Anything shorter than
 * `minimumRun` is left alone — folding four lines into a "show 4 lines" button
 * saves nothing and costs a click.
 */
export function buildBlocks(
  lineCount: number,
  hunks: readonly Hunk[],
  contextLines: number,
  minimumRun: number,
): RenderBlock[] {
  if (lineCount === 0) return []
  if (hunks.length === 0) {
    return lineCount >= minimumRun
      ? [{ kind: 'fold', from: 0, to: lineCount }]
      : [{ kind: 'lines', from: 0, to: lineCount }]
  }

  const visible: Array<[number, number]> = []
  for (const hunk of hunks) {
    const from = Math.max(0, hunk.start - contextLines)
    const to = Math.min(lineCount, hunk.end + contextLines)
    const previous = visible[visible.length - 1]

    if (previous !== undefined && from <= previous[1]) previous[1] = Math.max(previous[1], to)
    else visible.push([from, to])
  }

  const blocks: RenderBlock[] = []
  let position = 0

  const gap = (to: number): void => {
    if (to <= position) return
    blocks.push({ kind: to - position >= minimumRun ? 'fold' : 'lines', from: position, to })
    position = to
  }

  for (const [from, to] of visible) {
    gap(from)
    blocks.push({ kind: 'lines', from, to })
    position = to
  }
  gap(lineCount)

  return mergeAdjacentLineBlocks(blocks)
}

function mergeAdjacentLineBlocks(blocks: RenderBlock[]): RenderBlock[] {
  const merged: RenderBlock[] = []

  for (const block of blocks) {
    const previous = merged[merged.length - 1]
    if (previous?.kind === 'lines' && block.kind === 'lines' && previous.to === block.from) {
      previous.to = block.to
    } else {
      merged.push({ ...block })
    }
  }
  return merged
}
