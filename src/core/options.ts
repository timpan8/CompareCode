import type { DiffOptions } from './diff'
import { DEFAULT_DIFF_OPTIONS } from './diff'

export type ViewMode = 'split' | 'inline'
export type Palette = 'classic' | 'colorblind'
export type ThemePreference = 'system' | 'light' | 'dark'
export type Language = 'en' | 'sv'

export interface ViewOptions {
  mode: ViewMode
  palette: Palette
  theme: ThemePreference
  language: Language
  collapseUnchanged: boolean
  /** Unchanged lines kept visible on each side of a change. */
  contextLines: number
  wrapLines: boolean
  showWhitespace: boolean
  tabWidth: number
  /** Keep the pasted text in this browser so a closed tab does not lose it. */
  autosave: boolean
}

export const DEFAULT_VIEW_OPTIONS: ViewOptions = {
  mode: 'split',
  palette: 'classic',
  theme: 'system',
  language: 'en',
  collapseUnchanged: true,
  // CodeMirror's merge view settles on three lines of context, and it reads well.
  contextLines: 3,
  wrapLines: true,
  showWhitespace: false,
  tabWidth: 4,
  autosave: true,
}

/** Runs shorter than this are not worth hiding — the fold would take as much room. */
export const MIN_COLLAPSIBLE_RUN = 4

/** Below this width the two columns are too narrow to read; fall back to inline. */
export const INLINE_VIEW_BREAKPOINT = 720

export interface Settings {
  diff: DiffOptions
  view: ViewOptions
}

export const DEFAULT_SETTINGS: Settings = {
  diff: DEFAULT_DIFF_OPTIONS,
  view: DEFAULT_VIEW_OPTIONS,
}

/**
 * Rebuilds settings from whatever was stored, keeping only values of the right
 * shape. Anything unrecognised falls back to the default, so an old or corrupted
 * saved value can never wedge the app.
 */
export function mergeSettings(stored: unknown): Settings {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_SETTINGS

  const record = stored as Record<string, unknown>
  return {
    diff: mergeSection(DEFAULT_DIFF_OPTIONS, record['diff']),
    view: mergeSection(DEFAULT_VIEW_OPTIONS, record['view']),
  }
}

function mergeSection<T extends object>(defaults: T, stored: unknown): T {
  if (typeof stored !== 'object' || stored === null) return { ...defaults }

  const record = stored as Record<string, unknown>
  const result = { ...defaults }

  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const value = record[key]
    if (value !== null && typeof value === typeof defaults[key]) {
      result[key] = value as T[keyof T & string]
    }
  }
  return result
}
