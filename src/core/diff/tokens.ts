export interface Token {
  start: number
  end: number
  whitespace: boolean
}

function isWhitespaceCode(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13) || code === 0xa0
}

/**
 * Identifiers, numbers and anything non-ASCII hold together as one token; every
 * other character stands alone.
 *
 * Keeping non-ASCII in the word class is what stops `å`, a CJK character or an
 * emoji from being torn apart — an emoji is a surrogate pair, and splitting it
 * would produce garbage on screen.
 */
function isWordCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    (code >= 48 && code <= 57) || // 0-9
    code === 95 || // _
    code === 36 || // $
    code > 127
  )
}

/**
 * Splits a line into the units a word-level diff compares. Tokens are contiguous
 * and cover the whole line, so the renderer can walk them and never lose a
 * character.
 */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  const length = line.length
  let i = 0

  while (i < length) {
    const start = i
    const code = line.charCodeAt(i)

    if (isWhitespaceCode(code)) {
      while (i < length && isWhitespaceCode(line.charCodeAt(i))) i++
      tokens.push({ start, end: i, whitespace: true })
    } else if (isWordCode(code)) {
      while (i < length && isWordCode(line.charCodeAt(i))) i++
      tokens.push({ start, end: i, whitespace: false })
    } else {
      i++
      tokens.push({ start, end: i, whitespace: false })
    }
  }

  return tokens
}

/** Dice coefficient over character bigrams: cheap, symmetric, and good enough to rank line pairs. */
export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const counts = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2)
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }

  let shared = 0
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2)
    const remaining = counts.get(gram) ?? 0
    if (remaining > 0) {
      counts.set(gram, remaining - 1)
      shared++
    }
  }

  return (2 * shared) / (a.length - 1 + (b.length - 1))
}
