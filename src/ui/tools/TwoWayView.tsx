import { useState } from 'preact/hooks'
import type { DiffOptions } from '../../core/diff'
import { toUnifiedPatch } from '../../core/diff/patch'
import type { ViewOptions } from '../../core/options'
import type { TwoWayModel } from '../../core/tools/twoWay'
import { DiffView } from '../DiffView'
import type { Translate } from '../i18n'
import { SettingsPanel } from '../SettingsPanel'

export interface TwoWayViewProps {
  model: TwoWayModel
  diff: DiffOptions
  view: ViewOptions
  mode: 'split' | 'inline'
  narrow: boolean
  t: Translate
  onDiff: (patch: Partial<DiffOptions>) => void
  onView: (patch: Partial<ViewOptions>) => void
  onEdit: () => void
  onSwap: () => void
}

export function TwoWayView(props: TwoWayViewProps) {
  const { model, diff, view, mode, narrow, t, onDiff, onView, onEdit, onSwap } = props
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const { stats } = model.result
  const unchangedOnly = stats.added === 0 && stats.removed === 0 && stats.changed === 0
  const anyIgnoreActive =
    diff.ignoreAllWhitespace ||
    diff.ignoreLeadingWhitespace ||
    diff.ignoreTrailingWhitespace ||
    diff.ignoreBlankLines ||
    diff.ignoreCase

  const copy = (key: string, text: string): void => {
    const done = (): void => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => setCopied('failed'))
      return
    }

    // Older browsers, and any case where the clipboard API is unavailable.
    const scratch = document.createElement('textarea')
    scratch.value = text
    scratch.setAttribute('aria-hidden', 'true')
    scratch.style.position = 'fixed'
    scratch.style.opacity = '0'
    document.body.append(scratch)
    scratch.select()
    try {
      document.execCommand('copy')
      done()
    } catch {
      setCopied('failed')
    } finally {
      scratch.remove()
    }
  }

  const copyLabel = (key: string, fallback: string): string =>
    copied === key ? t('copy.done') : copied === 'failed' ? t('copy.failed') : fallback

  return (
    <div class="result">
      <div class="toolbar">
        <button type="button" class="button" onClick={onEdit}>
          {t('action.edit')}
        </button>

        <div class="stats">
          <span class="added">{t('stats.added', { count: stats.added })}</span>
          <span class="removed">{t('stats.removed', { count: stats.removed })}</span>
          <span class="changed">{t('stats.changed', { count: stats.changed })}</span>
          <span class="same">
            {t('stats.identical', { percent: Math.round(stats.similarity * 100) })}
          </span>
        </div>

        <span style={{ flex: 1 }} />

        <div class="segmented" role="group" aria-label={t('view.split')}>
          <button
            type="button"
            aria-pressed={mode === 'split'}
            disabled={narrow}
            onClick={() => onView({ mode: 'split' })}
          >
            {t('view.split')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'inline'}
            onClick={() => onView({ mode: 'inline' })}
          >
            {t('view.inline')}
          </button>
        </div>

        <label class="toggle">
          <input
            type="checkbox"
            checked={view.collapseUnchanged}
            onChange={(event) =>
              onView({ collapseUnchanged: (event.currentTarget as HTMLInputElement).checked })
            }
          />
          {t('view.collapse')}
        </label>

        <button type="button" class="button is-quiet" onClick={onSwap}>
          {t('role.swap')}
        </button>

        <button
          type="button"
          class="button is-quiet"
          onClick={() => copy('new', model.newDocument.content)}
        >
          {copyLabel('new', t('copy.new'))}
        </button>
        <button
          type="button"
          class="button is-quiet"
          onClick={() => copy('patch', toUnifiedPatch(model.result, view.contextLines))}
        >
          {copyLabel('patch', t('copy.patch'))}
        </button>

        <button
          type="button"
          class="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {t('action.settings')}
        </button>
      </div>

      {settingsOpen && (
        <SettingsPanel diff={diff} view={view} t={t} onDiff={onDiff} onView={onView} />
      )}

      {narrow && view.mode === 'split' && <div class="notice">{t('view.narrow')}</div>}
      {model.result.truncated && <div class="notice">{t('notice.truncated')}</div>}

      {unchangedOnly ? (
        <div class="empty-state">
          {anyIgnoreActive ? t('stats.noChangesIgnored') : t('stats.noChanges')}
        </div>
      ) : (
        <DiffView result={model.result} view={view} mode={mode} t={t} />
      )}
    </div>
  )
}
