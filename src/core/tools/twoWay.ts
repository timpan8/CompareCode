import { diffLineArrays, splitLines, type DiffOptions, type DiffResult } from '../diff'
import { documentWithRole, type Doc, type DocumentSet } from '../documents'
import type { ToolDefinition } from './registry'

export interface TwoWayModel {
  result: DiffResult
  oldDocument: Doc
  newDocument: Doc
}

export const TWO_WAY_TOOL_ID = 'two-way'

/**
 * Compares the document marked as old against the one marked as new — in that
 * order, whichever pane they happen to be sitting in.
 */
export function computeTwoWay(documents: Doc[], options: DiffOptions): TwoWayModel {
  const set: DocumentSet = { docs: documents, nextPasteOrder: 0 }
  const oldDocument = documentWithRole(set, 'old') ?? (documents[0] as Doc)
  const newDocument = documentWithRole(set, 'new') ?? (documents[1] as Doc)

  return {
    result: diffLineArrays(
      splitLines(oldDocument.content),
      splitLines(newDocument.content),
      options,
    ),
    oldDocument,
    newDocument,
  }
}

/** The interface supplies the component; the core never imports one. */
export function createTwoWayTool<View>(view: View): ToolDefinition<TwoWayModel, View> {
  return {
    id: TWO_WAY_TOOL_ID,
    name: 'Compare two',
    description: 'Show what changed between an old and a new version.',
    minDocuments: 2,
    maxDocuments: 2,
    compute: computeTwoWay,
    view,
  }
}
