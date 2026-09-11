import { useState } from 'preact/hooks'
import { splitLines } from '../core/diff'
import type { ContentUpdate, Doc } from '../core/documents'
import type { Translate } from './i18n'
import { RoleChip } from './RoleChip'

interface DocPaneProps {
  doc: Doc
  side: 'left' | 'right'
  t: Translate
  /** Show the old/new question over this pane. */
  ask: boolean
  onContent: (update: ContentUpdate) => void
  onChoose: (role: 'old' | 'new') => void
}

export function DocPane({ doc, side, t, ask, onContent, onChoose }: DocPaneProps) {
  const [dropTarget, setDropTarget] = useState(false)

  const lineCount = doc.content === '' ? 0 : splitLines(doc.content).length
  const roleClass = doc.role === 'old' ? 'is-old' : doc.role === 'new' ? 'is-new' : ''

  const handleDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDropTarget(false)

    const file = event.dataTransfer?.files?.[0]
    if (!file) return

    // Read locally through the File API. Nothing is uploaded; there is nowhere
    // for it to be uploaded to.
    void file.text().then((content) => {
      onContent({ content, filename: file.name, lastModified: file.lastModified })
    })
  }

  return (
    <section
      data-testid={`pane-${side}`}
      data-role={doc.role ?? 'none'}
      data-paste-order={doc.pasteOrder}
      class={`pane ${roleClass} ${dropTarget ? 'is-drop-target' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDropTarget(true)
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={handleDrop}
    >
      <header class="pane-header">
        {doc.role === null ? (
          <span class="pane-role pane-side">{t('pane.unmarked')}</span>
        ) : (
          <span class="pane-role">
            {doc.role === 'old' ? t('pane.old') : t('pane.new')}{' '}
            <span class="pane-side">
              ({side === 'left' ? t('pane.oldSide') : t('pane.newSide')})
            </span>
          </span>
        )}

        {doc.pasteOrder > 0 && (
          <span class="badge">
            {t('pane.pasted', {
              order: doc.pasteOrder === 1 ? t('pane.first') : t('pane.second'),
            })}
          </span>
        )}

        {doc.filename !== null && <span class="badge">{doc.filename}</span>}

        <span class="spacer" style={{ flex: 1 }} />
        <span class="pane-side">
          {dropTarget ? t('pane.dropHint') : t('pane.lines', { count: lineCount })}
        </span>
      </header>

      <textarea
        value={doc.content}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        placeholder={t('pane.placeholder')}
        aria-label={doc.role === 'old' ? t('pane.old') : doc.role === 'new' ? t('pane.new') : t('pane.unmarked')}
        onInput={(event) => onContent({ content: (event.currentTarget as HTMLTextAreaElement).value })}
      />

      {ask && <RoleChip t={t} onChoose={onChoose} />}
    </section>
  )
}
