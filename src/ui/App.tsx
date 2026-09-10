import { useEffect, useMemo, useState } from 'preact/hooks'
import type { DiffOptions } from '../core/diff'
import {
  assignRole,
  clearAll,
  createDocumentSet,
  documentAwaitingRole,
  isReady,
  setContent,
  suggestRoleFromTimestamps,
  swapRoles,
  type ContentUpdate,
  type Doc,
  type DocumentSet,
} from '../core/documents'
import {
  INLINE_VIEW_BREAKPOINT,
  mergeSettings,
  type Settings,
  type ViewOptions,
} from '../core/options'
import { DocPane } from './DocPane'
import { createTranslate, OTHER_LANGUAGE, type Translate } from './i18n'
import { DOCUMENTS_KEY, readStored, removeStored, SETTINGS_KEY, writeStored } from './storage'
import { twoWayTool } from './tools'

const REPOSITORY_URL = 'https://github.com/timpan8/CompareCode'

interface Notice {
  text: string
  actionLabel?: string
  action?: () => void
}

export function App() {
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(readStored(SETTINGS_KEY)))
  const [documents, setDocuments] = useState<DocumentSet>(restoreDocuments)
  const [stage, setStage] = useState<'edit' | 'result'>('edit')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [width, setWidth] = useState(() => window.innerWidth)

  const t = useMemo(() => createTranslate(settings.view.language), [settings.view.language])

  const narrow = width < INLINE_VIEW_BREAKPOINT
  const mode = narrow ? 'inline' : settings.view.mode
  const ready = isReady(documents)
  const awaiting = documentAwaitingRole(documents)

  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (settings.view.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.view.theme)
    root.setAttribute('data-palette', settings.view.palette)
    root.lang = settings.view.language
  }, [settings.view.theme, settings.view.palette, settings.view.language])

  useEffect(() => {
    writeStored(SETTINGS_KEY, settings)
  }, [settings])

  useEffect(() => {
    if (settings.view.autosave) writeStored(DOCUMENTS_KEY, documents)
    else removeStored(DOCUMENTS_KEY)
  }, [documents, settings.view.autosave])

  const applyRole = (id: string, role: 'old' | 'new'): void => {
    const before = documents
    const { set, swapped } = assignRole(documents, id, role)
    setDocuments(set)

    if (swapped) {
      setNotice({
        text: t('role.swapped'),
        actionLabel: t('role.undo'),
        action: () => {
          setDocuments(before)
          setNotice(null)
        },
      })
    } else {
      setNotice(null)
    }
  }

  const swap = (): void => {
    setDocuments(swapRoles(documents).set)
    setNotice(null)
  }

  const handleContent = (id: string, update: ContentUpdate): void => {
    let next = setContent(documents, id, update)

    // Two dropped files with different timestamps say which is newer on their
    // own, so there is nothing worth asking. Only ever before anything has been
    // decided; a guess must not overrule an answer already given.
    const suggested = suggestRoleFromTimestamps(next)
    if (suggested !== null) {
      next = assignRole(next, suggested.id, suggested.role).set
      setNotice({
        text: t('role.suggested'),
        actionLabel: t('role.swap'),
        action: () => {
          setDocuments((current) => swapRoles(current).set)
          setNotice(null)
        },
      })
    }

    setDocuments(next)
  }

  const clear = (): void => {
    setDocuments(clearAll(documents))
    removeStored(DOCUMENTS_KEY)
    setStage('edit')
    setNotice(null)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        swap()
      } else if (modifier && event.key === 'Enter' && ready) {
        event.preventDefault()
        setNotice(null)
        setStage('result')
      } else if (event.key === 'Escape' && stage === 'result') {
        setStage('edit')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const model = useMemo(
    () => (stage === 'result' ? twoWayTool.compute(documents.docs, settings.diff) : null),
    [stage, documents, settings.diff],
  )

  const patchDiff = (patch: Partial<DiffOptions>): void =>
    setSettings((current) => ({ ...current, diff: { ...current.diff, ...patch } }))
  const patchView = (patch: Partial<ViewOptions>): void =>
    setSettings((current) => ({ ...current, view: { ...current.view, ...patch } }))

  const ToolView = twoWayTool.view

  return (
    <div class="app">
      <header class="header">
        <h1>{t('app.name')}</h1>
        <span class="shield">
          <ShieldIcon />
          {t('privacy.badge')}
        </span>
        <span class="spacer" style={{ flex: 1 }} />
        <button
          type="button"
          class="button is-quiet"
          aria-label={t('language.label')}
          onClick={() => patchView({ language: OTHER_LANGUAGE[settings.view.language] })}
        >
          {t('language.switch')}
        </button>
        <button type="button" class="button is-quiet" onClick={clear}>
          {t('action.clear')}
        </button>
      </header>

      <main class="main">
        {notice !== null && (
          <div class="notice">
            <span>{notice.text}</span>
            {notice.action !== undefined && (
              <button type="button" class="link-button" onClick={notice.action}>
                {notice.actionLabel}
              </button>
            )}
          </div>
        )}

        {stage === 'edit' || model === null ? (
          <>
            <div class="panes">
              {documents.docs.map((doc: Doc, index: number) => (
                <DocPane
                  key={doc.id}
                  doc={doc}
                  side={index === 0 ? 'left' : 'right'}
                  t={t}
                  ask={awaiting?.id === doc.id}
                  onContent={(update) => handleContent(doc.id, update)}
                  onChoose={(role) => applyRole(doc.id, role)}
                />
              ))}
            </div>

            <div class="actions">
              <button
                type="button"
                class="button is-primary"
                disabled={!ready}
                onClick={() => {
                  setNotice(null)
                  setStage('result')
                }}
              >
                {t('action.compare')}
              </button>
              <button type="button" class="button" onClick={swap}>
                {t('role.swap')}
              </button>
            </div>
          </>
        ) : (
          <ToolView
            model={model}
            diff={settings.diff}
            view={settings.view}
            mode={mode}
            narrow={narrow}
            t={t}
            onDiff={patchDiff}
            onView={patchView}
            onEdit={() => setStage('edit')}
            onSwap={swap}
          />
        )}
      </main>

      <Footer t={t} />
    </div>
  )
}

function Footer({ t }: { t: Translate }) {
  const hosted = window.location.protocol === 'http:' || window.location.protocol === 'https:'

  return (
    <footer class="footer">
      <span>{t('privacy.short')}</span>
      {hosted ? (
        <a href="./CompareCode.html" download="CompareCode.html">
          {t('privacy.offline')}
        </a>
      ) : (
        <span>{t('privacy.offlineRunning')}</span>
      )}
      <a href={REPOSITORY_URL} rel="noreferrer">
        {t('privacy.source')}
      </a>
      <span class="spacer" style={{ flex: 1 }} />
      <span>{t('nav.hint')}</span>
    </footer>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M8 1.5 3 3.4v4.2c0 3 2 5.6 5 6.9 3-1.3 5-3.9 5-6.9V3.4L8 1.5Z" />
      <path d="m5.8 7.9 1.6 1.6 3-3.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

function restoreDocuments(): DocumentSet {
  const stored = readStored(DOCUMENTS_KEY)
  if (typeof stored !== 'object' || stored === null) return createDocumentSet()

  const record = stored as Record<string, unknown>
  if (!Array.isArray(record['docs']) || record['docs'].length !== 2) return createDocumentSet()

  const docs = (record['docs'] as unknown[]).map((entry, index) => {
    const fallback = createDocumentSet().docs[index] as Doc
    if (typeof entry !== 'object' || entry === null) return fallback

    const item = entry as Record<string, unknown>
    const role = item['role']

    return {
      id: typeof item['id'] === 'string' ? item['id'] : fallback.id,
      content: typeof item['content'] === 'string' ? item['content'] : '',
      role: role === 'old' || role === 'new' ? role : null,
      pasteOrder: typeof item['pasteOrder'] === 'number' ? item['pasteOrder'] : 0,
      filename: typeof item['filename'] === 'string' ? item['filename'] : null,
      lastModified: typeof item['lastModified'] === 'number' ? item['lastModified'] : null,
    } satisfies Doc
  })

  const nextPasteOrder =
    typeof record['nextPasteOrder'] === 'number' ? record['nextPasteOrder'] : 1

  return { docs, nextPasteOrder }
}
