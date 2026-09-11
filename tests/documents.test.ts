import { describe, expect, it } from 'vitest'
import {
  assignRole,
  createDocumentSet,
  documentAwaitingRole,
  isReady,
  setContent,
  suggestRoleFromTimestamps,
  swapRoles,
} from '../src/core/documents'

const left = (set: ReturnType<typeof createDocumentSet>) => set.docs[0]!
const right = (set: ReturnType<typeof createDocumentSet>) => set.docs[1]!

describe('old / new marking', () => {
  it('asks about the first text and nothing before it', () => {
    let set = createDocumentSet()
    expect(documentAwaitingRole(set)).toBeNull()

    set = setContent(set, 'a', { content: 'first' })
    expect(documentAwaitingRole(set)?.id).toBe('a')
  })

  it('moves the new version to the right and reports that it did', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'the new version' })

    const { set: assigned, swapped } = assignRole(set, 'a', 'new')

    expect(swapped).toBe(true)
    expect(left(assigned).content).toBe('')
    expect(right(assigned).content).toBe('the new version')
    expect(right(assigned).role).toBe('new')
    expect(left(assigned).role).toBe('old')
  })

  it('keeps track of which text was entered first, even after it changes sides', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'entered first' })
    set = assignRole(set, 'a', 'new').set
    set = setContent(set, left(set).id, { content: 'entered second' })

    expect(right(set).pasteOrder).toBe(1)
    expect(left(set).pasteOrder).toBe(2)
  })

  it('labels the empty pane straight away, so the question is never asked twice', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'old text' })
    set = assignRole(set, 'a', 'old').set

    // Before a single character is typed there, the other pane already says NEW.
    expect(right(set).role).toBe('new')
    expect(right(set).content).toBe('')

    set = setContent(set, 'b', { content: 'new text' })
    expect(documentAwaitingRole(set)).toBeNull()
  })

  it('swaps the sides on request', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'old text' })
    set = assignRole(set, 'a', 'old').set
    set = setContent(set, 'b', { content: 'new text' })
    set = assignRole(set, 'b', 'new').set

    const swapped = swapRoles(set).set
    expect(left(swapped).content).toBe('new text')
    expect(left(swapped).role).toBe('old')
  })

  it('suggests an order from file timestamps', () => {
    let set = createDocumentSet()
    expect(suggestRoleFromTimestamps(set)).toBeNull()

    set = setContent(set, 'a', { content: 'x', filename: 'a.ts', lastModified: 2000 })
    set = setContent(set, 'b', { content: 'y', filename: 'b.ts', lastModified: 1000 })

    expect(suggestRoleFromTimestamps(set)).toEqual({ id: 'b', role: 'old' })
  })

  it('never lets a timestamp guess overrule an answer that was given', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'x', filename: 'a.ts', lastModified: 2000 })
    set = setContent(set, 'b', { content: 'y', filename: 'b.ts', lastModified: 1000 })
    set = assignRole(set, 'a', 'old').set

    expect(suggestRoleFromTimestamps(set)).toBeNull()
  })

  it('starts over once both panes are emptied', () => {
    let set = createDocumentSet()
    set = setContent(set, 'a', { content: 'old text' })
    set = assignRole(set, 'a', 'old').set
    set = setContent(set, 'b', { content: 'new text' })
    expect(isReady(set)).toBe(true)

    set = setContent(set, 'a', { content: '' })
    set = setContent(set, 'b', { content: '' })

    expect(set.docs.every((doc) => doc.role === null)).toBe(true)
    expect(set.nextPasteOrder).toBe(1)
    expect(isReady(set)).toBe(false)
  })
})
