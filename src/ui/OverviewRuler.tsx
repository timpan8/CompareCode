import type { Hunk } from '../core/diff'

interface OverviewRulerProps {
  hunks: readonly Hunk[]
  lineCount: number
  onJump: (line: number) => void
  label: string
}

/**
 * A map of the whole comparison down the right-hand edge: where the changes are,
 * how they are spread, and one click to get to any of them. Borrowed from the
 * overview ruler in VS Code's diff editor, which answers "is this a small tweak
 * or a rewrite?" before you scroll at all.
 */
export function OverviewRuler({ hunks, lineCount, onJump, label }: OverviewRulerProps) {
  if (lineCount === 0 || hunks.length === 0) return null

  const handleClick = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLDivElement
    const bounds = target.getBoundingClientRect()
    const fraction = (event.clientY - bounds.top) / bounds.height
    const wanted = fraction * lineCount

    let nearest = hunks[0] as Hunk
    for (const hunk of hunks) {
      if (Math.abs(hunk.start - wanted) < Math.abs(nearest.start - wanted)) nearest = hunk
    }
    onJump(nearest.start)
  }

  return (
    <div class="ruler" onClick={handleClick} role="presentation" title={label}>
      {hunks.map((hunk) => {
        const kind = hunk.aCount === 0 ? 'add' : hunk.bCount === 0 ? 'del' : 'mixed'
        return (
          <div
            key={hunk.start}
            class={`ruler-mark ${kind}`}
            style={{
              top: `${(hunk.start / lineCount) * 100}%`,
              height: `${Math.max(0.35, ((hunk.end - hunk.start) / lineCount) * 100)}%`,
            }}
          />
        )
      })}
    </div>
  )
}
