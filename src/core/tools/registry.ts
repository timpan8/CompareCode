import type { DiffOptions } from '../diff'
import type { Doc } from '../documents'

/**
 * A tool is a pure `compute` plus whatever the interface needs to draw it.
 *
 * The view is left as an opaque type parameter on purpose: `src/core` must not
 * know that a user interface exists, let alone which framework draws it. The UI
 * layer supplies the concrete component type when it registers a tool, which is
 * what keeps the engine testable in isolation and reusable by a future tool that
 * compares more than two documents.
 */
export interface ToolDefinition<Model = unknown, View = unknown> {
  id: string
  name: string
  description: string
  minDocuments: number
  maxDocuments: number
  /** Pure: no DOM, no I/O, safe to move onto a worker later. */
  compute(documents: Doc[], options: DiffOptions): Model
  view: View
}

const registry = new Map<string, ToolDefinition>()

export function registerTool<Model, View>(tool: ToolDefinition<Model, View>): void {
  registry.set(tool.id, tool as ToolDefinition)
}

export function getTool(id: string): ToolDefinition | undefined {
  return registry.get(id)
}

export function listTools(): ToolDefinition[] {
  return [...registry.values()]
}

export function toolAcceptsCount(tool: ToolDefinition, count: number): boolean {
  return count >= tool.minDocuments && count <= tool.maxDocuments
}
