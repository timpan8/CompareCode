import type { DiffOptions } from './types'

/**
 * Splits text into lines the way a person reading code counts them.
 *
 * A byte-order mark is dropped, CRLF and LF are treated the same, and a single
 * trailing newline does not produce a phantom empty last line — pasted code
 * almost always has one and it is never the difference you care about.
 */
export function splitLines(text: string): string[] {
  if (text === '') return []

  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const body = withoutBom.endsWith('\n') ? withoutBom.slice(0, -1) : withoutBom
  const lines = body.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.endsWith('\r')) lines[i] = line.slice(0, -1)
  }
  return lines
}

export function isBlank(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i)
    if (c !== 32 && c !== 9 && c !== 11 && c !== 12 && c !== 13 && c !== 0xa0) return false
  }
  return true
}

/**
 * The key a line is compared by. The original text is never modified — every
 * ignore-option lives here and only here, so what is drawn on screen is always
 * exactly what you pasted.
 */
export function normalizeLine(line: string, options: DiffOptions): string {
  let key = line

  if (options.ignoreAllWhitespace) {
    key = key.replace(/\s+/g, '')
  } else {
    if (options.ignoreLeadingWhitespace) key = key.replace(/^\s+/, '')
    if (options.ignoreTrailingWhitespace) key = key.replace(/\s+$/, '')
  }
  if (options.ignoreCase) key = key.toLowerCase()

  return key
}

/**
 * Maps each line to an integer so the diff compares numbers instead of strings.
 * Both sides must share one table, or equal lines would get different ids.
 */
export function internLines(
  lines: readonly string[],
  table: Map<string, number>,
  options: DiffOptions,
): Int32Array {
  const ids = new Int32Array(lines.length)

  for (let i = 0; i < lines.length; i++) {
    const key = normalizeLine(lines[i] as string, options)
    let id = table.get(key)
    if (id === undefined) {
      id = table.size
      table.set(key, id)
    }
    ids[i] = id
  }
  return ids
}
