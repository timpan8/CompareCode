/**
 * The documents being compared, and which of them is the old one.
 *
 * The important idea: a document's *side* is derived from its role, never from
 * where the text happened to land. Marking the left-hand text as the new version
 * moves it to the right, and `pasteOrder` travels with it — so "which one did I
 * paste first?" always has an answer, even after everything has moved around.
 *
 * The set holds a list rather than a pair because the N-way tool will need more
 * than two; the two-way helpers below simply operate on the first two.
 */

export type DocumentRole = 'old' | 'new' | null

export interface Doc {
  id: string
  content: string
  role: DocumentRole
  /** 1 for the first text entered, 2 for the second; 0 while the document is empty. */
  pasteOrder: number
  filename: string | null
  /** Last-modified time of a dropped file, used to guess which version is newer. */
  lastModified: number | null
}

export interface DocumentSet {
  /** Render order: index 0 is the left pane, index 1 the right. */
  docs: Doc[]
  nextPasteOrder: number
}

export function createDocument(id: string): Doc {
  return { id, content: '', role: null, pasteOrder: 0, filename: null, lastModified: null }
}

export function createDocumentSet(): DocumentSet {
  return { docs: [createDocument('a'), createDocument('b')], nextPasteOrder: 1 }
}

export function documentById(set: DocumentSet, id: string): Doc | undefined {
  return set.docs.find((doc) => doc.id === id)
}

export function documentWithRole(set: DocumentSet, role: Exclude<DocumentRole, null>): Doc | undefined {
  return set.docs.find((doc) => doc.role === role)
}

export function isEmpty(set: DocumentSet): boolean {
  return set.docs.every((doc) => doc.content === '')
}

/** True once every document has both content and a role, so a comparison can run. */
export function isReady(set: DocumentSet): boolean {
  return set.docs.length >= 2 && set.docs.every((doc) => doc.content !== '' && doc.role !== null)
}

export interface ContentUpdate {
  content: string
  filename?: string | null
  lastModified?: number | null
}

export function setContent(set: DocumentSet, id: string, update: ContentUpdate): DocumentSet {
  let nextPasteOrder = set.nextPasteOrder

  const docs = set.docs.map((doc) => {
    if (doc.id !== id) return doc

    const wasEmpty = doc.content === ''
    const isNowEmpty = update.content === ''
    let pasteOrder = doc.pasteOrder

    if (wasEmpty && !isNowEmpty) pasteOrder = nextPasteOrder++
    else if (isNowEmpty) pasteOrder = 0

    return {
      ...doc,
      content: update.content,
      pasteOrder,
      filename: update.filename !== undefined ? update.filename : doc.filename,
      lastModified: update.lastModified !== undefined ? update.lastModified : doc.lastModified,
    }
  })

  const next: DocumentSet = { docs, nextPasteOrder }

  // Emptying everything starts over, including the old/new question.
  if (isEmpty(next)) {
    return { docs: docs.map((doc) => ({ ...doc, role: null, pasteOrder: 0 })), nextPasteOrder: 1 }
  }
  return next
}

/**
 * Gives a document its role, gives the other one the opposite, and puts the new
 * version on the right. Reports whether the two panes had to change places, so
 * the interface can say so out loud instead of silently moving the text.
 *
 * The other pane gets its label immediately, even while it is still empty. That
 * is the point: after answering once you can see where the second version is
 * meant to go, and the question is never asked twice.
 */
export function assignRole(
  set: DocumentSet,
  id: string,
  role: Exclude<DocumentRole, null>,
): { set: DocumentSet; swapped: boolean } {
  const opposite: DocumentRole = role === 'old' ? 'new' : 'old'
  const docs = set.docs.map((doc) =>
    doc.id === id ? { ...doc, role } : { ...doc, role: opposite },
  )

  return normalise({ ...set, docs })
}

/** Swaps which document is the old one. The text changes sides with it. */
export function swapRoles(set: DocumentSet): { set: DocumentSet; swapped: boolean } {
  const docs = set.docs.map((doc) => ({
    ...doc,
    role: doc.role === 'old' ? ('new' as const) : doc.role === 'new' ? ('old' as const) : null,
  }))
  return normalise({ ...set, docs })
}

export function clearAll(set: DocumentSet): DocumentSet {
  return { docs: set.docs.map((doc) => createDocument(doc.id)), nextPasteOrder: 1 }
}

/** The new version belongs on the right; if it is not there, move it. */
function normalise(set: DocumentSet): { set: DocumentSet; swapped: boolean } {
  const [first, second] = set.docs
  if (set.docs.length === 2 && first !== undefined && second !== undefined && first.role === 'new') {
    return { set: { ...set, docs: [second, first] }, swapped: true }
  }
  return { set, swapped: false }
}

/**
 * The document that should be asked about: it has text but no role, and neither
 * does anything else, so there is nothing to infer the answer from.
 */
export function documentAwaitingRole(set: DocumentSet): Doc | null {
  const anyRoleAssigned = set.docs.some((doc) => doc.role !== null)
  if (anyRoleAssigned) return null
  return set.docs.find((doc) => doc.content !== '' && doc.role === null) ?? null
}

/**
 * When both documents came from dropped files with known timestamps, the older
 * file is almost certainly the old version. Only ever a suggestion, and only
 * before anything has been decided — a guess must never overrule an answer the
 * person already gave.
 */
export function suggestRoleFromTimestamps(
  set: DocumentSet,
): { id: string; role: Exclude<DocumentRole, null> } | null {
  if (set.docs.some((doc) => doc.role !== null)) return null

  const [first, second] = set.docs
  if (first === undefined || second === undefined) return null
  if (first.content === '' || second.content === '') return null
  if (first.lastModified === null || second.lastModified === null) return null
  if (first.lastModified === second.lastModified) return null

  const older = first.lastModified < second.lastModified ? first : second
  return { id: older.id, role: 'old' }
}
