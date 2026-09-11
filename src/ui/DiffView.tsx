import { Fragment, type ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { DiffLine, DiffResult, TokenSpan } from '../core/diff'
import { MIN_COLLAPSIBLE_RUN, type ViewOptions } from '../core/options'
import { buildBlocks, type RenderBlock } from './blocks'
import type { Translate } from './i18n'
import { OverviewRuler } from './OverviewRuler'

/** Rows rendered before the rest is added on scroll, so a huge diff still opens instantly. */
const INITIAL_ROWS = 1200
const ROW_STEP = 1200

interface DiffViewProps {
  result: DiffResult
  view: ViewOptions
  mode: 'split' | 'inline'
  t: Translate
}

export function DiffView({ result, view, mode, t }: DiffViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  const [limit, setLimit] = useState(INITIAL_ROWS)
  const [pendingJump, setPendingJump] = useState<number | null>(null)
  const [scrollable, setScrollable] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef(-1)

  const blocks = useMemo(() => {
    const built = view.collapseUnchanged
      ? buildBlocks(result.lines.length, result.hunks, view.contextLines, MIN_COLLAPSIBLE_RUN)
      : [{ kind: 'lines' as const, from: 0, to: result.lines.length }]

    return built.map((block) =>
      block.kind === 'fold' && expanded.has(block.from)
        ? { ...block, kind: 'lines' as const }
        : block,
    )
  }, [result, view.collapseUnchanged, view.contextLines, expanded])

  const visible = useMemo(() => takeUpTo(blocks, limit), [blocks, limit])
  const hasMore = visible.length < blocks.length

  // Reset the window whenever a different comparison is shown.
  useEffect(() => {
    setLimit(INITIAL_ROWS)
    setExpanded(new Set())
    cursorRef.current = -1
  }, [result])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!hasMore || sentinel === null) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + ROW_STEP)
      },
      { root: scrollRef.current, rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, visible.length])

  const jumpTo = (line: number): void => {
    setLimit((current) => Math.max(current, rowsUpTo(blocks, line) + ROW_STEP))
    setPendingJump(line)
  }

  // A map of the changes only earns its place when there is something off-screen
  // to find; on a short diff it would point at empty space.
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (container !== null) setScrollable(container.scrollHeight > container.clientHeight + 4)
  })

  useLayoutEffect(() => {
    if (pendingJump === null) return
    const container = scrollRef.current
    const target = container?.querySelector(`[data-line="${pendingJump}"]`)
    target?.scrollIntoView({ block: 'center' })
    setPendingJump(null)
  }, [pendingJump])

  // n / p walk through the changes without touching the mouse.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return
      if (result.hunks.length === 0) return

      if (event.key === 'n' || event.key === 'j') {
        cursorRef.current = Math.min(cursorRef.current + 1, result.hunks.length - 1)
      } else if (event.key === 'p' || event.key === 'k') {
        cursorRef.current = Math.max(cursorRef.current - 1, 0)
      } else {
        return
      }

      event.preventDefault()
      jumpTo((result.hunks[cursorRef.current] as { start: number }).start)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (result.lines.length === 0) {
    return <div class="empty-state">{t('stats.noChanges')}</div>
  }

  const gridClass = [
    'diff',
    mode === 'split' ? 'is-split' : 'is-inline',
    view.wrapLines ? 'is-wrapped' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div class="with-ruler">
      <div class="diff-scroll" ref={scrollRef}>
        <div class={gridClass} style={{ '--tab-width': String(view.tabWidth) }}>
          {visible.map((block) =>
            block.kind === 'fold' ? (
              <button
                type="button"
                key={`fold-${block.from}`}
                class="fold"
                onClick={() =>
                  setExpanded((current) => new Set(current).add(block.from))
                }
              >
                ⋯ {t('view.expandFold', { count: block.to - block.from })}
              </button>
            ) : (
              <Fragment key={`lines-${block.from}`}>
                {renderRange(result.lines, block, mode, view)}
              </Fragment>
            ),
          )}
          {hasMore && <div class="sentinel" ref={sentinelRef} />}
        </div>
      </div>

      {scrollable && (
        <OverviewRuler
          hunks={result.hunks}
          lineCount={result.lines.length}
          onJump={jumpTo}
          label={t('nav.hint')}
        />
      )}
    </div>
  )
}

function renderRange(
  lines: readonly DiffLine[],
  block: RenderBlock,
  mode: 'split' | 'inline',
  view: ViewOptions,
): ComponentChildren[] {
  const out: ComponentChildren[] = []

  for (let i = block.from; i < block.to; i++) {
    const line = lines[i] as DiffLine
    if (mode === 'split') out.push(<SplitRow key={i} index={i} line={line} view={view} />)
    else out.push(...inlineRows(i, line, view))
  }
  return out
}

function SplitRow({ index, line, view }: { index: number; line: DiffLine; view: ViewOptions }) {
  const leftChanged = line.op === 'delete' || line.op === 'replace'
  const rightChanged = line.op === 'insert' || line.op === 'replace'

  const leftClass = [
    line.aIndex === null ? 'is-blank' : leftChanged ? 'is-del' : '',
    line.filler ? 'is-filler' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const rightClass = [
    line.bIndex === null ? 'is-blank' : rightChanged ? 'is-add' : '',
    line.filler ? 'is-filler' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Fragment>
      <div class={`cell num ${leftClass}`} data-line={index}>
        {line.aIndex === null ? '' : line.aIndex + 1}
      </div>
      <div class={`cell sign ${leftClass}`}>{leftChanged ? '−' : ''}</div>
      <div class={`cell text ${leftClass}`}>
        {renderText(line.aText, leftChanged ? line.words?.a ?? null : null, view.showWhitespace)}
      </div>

      <div class={`cell num pad-left ${rightClass}`}>
        {line.bIndex === null ? '' : line.bIndex + 1}
      </div>
      <div class={`cell sign ${rightClass}`}>{rightChanged ? '+' : ''}</div>
      <div class={`cell text ${rightClass}`}>
        {renderText(line.bText, rightChanged ? line.words?.b ?? null : null, view.showWhitespace)}
      </div>
    </Fragment>
  )
}

function inlineRows(index: number, line: DiffLine, view: ViewOptions): ComponentChildren[] {
  const row = (
    key: string,
    aNumber: number | null,
    bNumber: number | null,
    sign: string,
    text: string,
    spans: TokenSpan[] | null,
    state: string,
  ): ComponentChildren => (
    <Fragment key={key}>
      <div class={`cell num ${state}`} data-line={index}>
        {aNumber === null ? '' : aNumber + 1}
      </div>
      <div class={`cell num ${state}`}>{bNumber === null ? '' : bNumber + 1}</div>
      <div class={`cell sign ${state}`}>{sign}</div>
      <div class={`cell text ${state}`}>{renderText(text, spans, view.showWhitespace)}</div>
    </Fragment>
  )

  switch (line.op) {
    case 'equal':
      return [
        row(
          `e${index}`,
          line.aIndex,
          line.bIndex,
          '',
          line.aIndex === null ? line.bText : line.aText,
          null,
          line.filler ? 'is-filler' : '',
        ),
      ]
    case 'delete':
      return [row(`d${index}`, line.aIndex, null, '−', line.aText, null, 'is-del')]
    case 'insert':
      return [row(`i${index}`, null, line.bIndex, '+', line.bText, null, 'is-add')]
    case 'replace':
      return [
        row(`r${index}a`, line.aIndex, null, '−', line.aText, line.words?.a ?? null, 'is-del'),
        row(`r${index}b`, null, line.bIndex, '+', line.bText, line.words?.b ?? null, 'is-add'),
      ]
  }
}

function renderText(
  text: string,
  spans: TokenSpan[] | null,
  showWhitespace: boolean,
): ComponentChildren {
  if (text === '') return null
  if (spans === null) return renderPlain(text, showWhitespace)

  return spans.map((span, index) => {
    const slice = text.slice(span.start, span.end)
    const content = renderPlain(slice, showWhitespace)
    return span.changed ? (
      <span class="word" key={index}>
        {content}
      </span>
    ) : (
      <Fragment key={index}>{content}</Fragment>
    )
  })
}

/**
 * Marks runs of spaces and tabs without replacing them, so turning the option on
 * shows where the whitespace is without shifting a single character.
 */
function renderPlain(text: string, showWhitespace: boolean): ComponentChildren {
  if (!showWhitespace) return text

  const parts: ComponentChildren[] = []
  const pattern = /[ \t]+/g
  let last = 0
  let match = pattern.exec(text)

  while (match !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <span class="ws-hint" key={match.index}>
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
    match = pattern.exec(text)
  }
  if (last < text.length) parts.push(text.slice(last))

  return parts
}

function takeUpTo(blocks: readonly RenderBlock[], limit: number): RenderBlock[] {
  const out: RenderBlock[] = []
  let rows = 0

  for (const block of blocks) {
    out.push(block)
    rows += block.kind === 'fold' ? 1 : block.to - block.from
    if (rows >= limit) break
  }
  return out
}

function rowsUpTo(blocks: readonly RenderBlock[], line: number): number {
  let rows = 0

  for (const block of blocks) {
    if (block.from > line) break
    rows += block.kind === 'fold' ? 1 : Math.min(block.to, line + 1) - block.from
  }
  return rows
}
