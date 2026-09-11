import { describe, expect, it } from 'vitest'
import { diffText, similarity, splitLines } from '../src/core/diff'
import type { DiffLine, DiffResult } from '../src/core/diff'
import { getIndent } from '../src/core/diff/slider'
import { tokenize } from '../src/core/diff/tokens'

/**
 * Every line of A must appear exactly once, in order, among the rows that carry a
 * left-hand side — and the same for B on the right. If that holds, the row model
 * is a faithful alignment of the two inputs, which is the one thing the whole
 * renderer depends on.
 */
function expectFaithfulAlignment(result: DiffResult, a: string, b: string): void {
  const left = result.lines.filter((line) => line.aIndex !== null)
  const right = result.lines.filter((line) => line.bIndex !== null)

  expect(left.map((line) => line.aText)).toEqual(splitLines(a))
  expect(right.map((line) => line.bText)).toEqual(splitLines(b))
  expect(left.map((line) => line.aIndex)).toEqual(left.map((_, i) => i))
  expect(right.map((line) => line.bIndex)).toEqual(right.map((_, i) => i))
}

const ops = (result: DiffResult): string[] => result.lines.map((line) => line.op)

describe('splitLines', () => {
  it('treats CRLF, a byte-order mark and a trailing newline as invisible', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b'])
    expect(splitLines('﻿a\nb')).toEqual(['a', 'b'])
    expect(splitLines('a\n')).toEqual(['a'])
    expect(splitLines('a\n\n')).toEqual(['a', ''])
    expect(splitLines('')).toEqual([])
  })
})

describe('diffText', () => {
  it('reports identical input as identical', () => {
    const text = 'const a = 1\nconst b = 2\n'
    const result = diffText(text, text)

    expect(ops(result)).toEqual(['equal', 'equal'])
    expect(result.stats.similarity).toBe(1)
    expect(result.hunks).toHaveLength(0)
  })

  it('handles an empty side', () => {
    const result = diffText('', 'hello\n')
    expect(ops(result)).toEqual(['insert'])
    expect(result.stats.added).toBe(1)
    expectFaithfulAlignment(result, '', 'hello\n')
  })

  it('finds an inserted line', () => {
    const a = 'one\ntwo\nthree\n'
    const b = 'one\ntwo\nextra\nthree\n'
    const result = diffText(a, b)

    expect(ops(result)).toEqual(['equal', 'equal', 'insert', 'equal'])
    expectFaithfulAlignment(result, a, b)
  })

  it('finds a deleted line', () => {
    const a = 'one\ntwo\nthree\n'
    const b = 'one\nthree\n'
    const result = diffText(a, b)

    expect(ops(result)).toEqual(['equal', 'delete', 'equal'])
    expectFaithfulAlignment(result, a, b)
  })

  it('pairs a changed line and marks only the word that changed', () => {
    const result = diffText('const total = price * 2\n', 'const total = price * 3\n')
    const row = result.lines[0] as DiffLine

    expect(row.op).toBe('replace')
    expect(row.words).not.toBeNull()

    const changed = row.words!.b.filter((span) => span.changed)
    expect(changed).toHaveLength(1)
    expect('const total = price * 3'.slice(changed[0]!.start, changed[0]!.end)).toBe('3')
  })

  it('drops word detail when the line was rewritten rather than edited', () => {
    const result = diffText(
      'return await fetchUserProfile(userId, options)\n',
      'throw new IllegalStateException("nope")\n',
    )
    const row = result.lines[0] as DiffLine

    expect(row.op).toBe('replace')
    expect(row.words).toBeNull()
  })

  it('notices when two lines differ only in whitespace', () => {
    const result = diffText('  value = 1\n', '\tvalue  =  1\n')
    const row = result.lines[0] as DiffLine

    expect(row.op).toBe('replace')
    expect(row.whitespaceOnly).toBe(true)
  })
})

describe('histogram anchoring', () => {
  it('attributes an added function to itself, not to the braces around it', () => {
    const a = [
      'function one() {',
      '  return 1',
      '}',
      '',
      'function three() {',
      '  return 3',
      '}',
      '',
    ].join('\n')

    const b = [
      'function one() {',
      '  return 1',
      '}',
      '',
      'function two() {',
      '  return 2',
      '}',
      '',
      'function three() {',
      '  return 3',
      '}',
      '',
    ].join('\n')

    const result = diffText(a, b)
    const inserted = result.lines
      .filter((line) => line.op === 'insert')
      .map((line) => line.bText)

    // The whole new function, and nothing belonging to its neighbours.
    expect(inserted).toEqual(['function two() {', '  return 2', '}', ''])
    expect(result.hunks).toHaveLength(1)
    expectFaithfulAlignment(result, a, b)
  })

  it('still terminates when no line in the range is unique', () => {
    const a = '}\n}\n}\n}\n'
    const b = '}\n}\n'
    const result = diffText(a, b)

    expect(result.stats.removed).toBe(2)
    expectFaithfulAlignment(result, a, b)
  })
})

describe('slider heuristic', () => {
  it('starts an inserted block at the blank line, not at the closing brace', () => {
    const a = ['def a():', '    return 1', '', 'def c():', '    return 3', ''].join('\n')
    const b = [
      'def a():',
      '    return 1',
      '',
      'def b():',
      '    return 2',
      '',
      'def c():',
      '    return 3',
      '',
    ].join('\n')

    const inserted = diffText(a, b)
      .lines.filter((line) => line.op === 'insert')
      .map((line) => line.bText)

    expect(inserted).toEqual(['def b():', '    return 2', ''])
  })

  it('measures indentation the way an editor shows it', () => {
    expect(getIndent('    x')).toBe(4)
    expect(getIndent('\tx')).toBe(8)
    expect(getIndent('  \tx')).toBe(8)
    expect(getIndent('   ')).toBe(-1)
    expect(getIndent('')).toBe(-1)
  })
})

describe('ignore options', () => {
  it('ignores case when asked', () => {
    const result = diffText('const Value = 1\n', 'const value = 1\n', { ignoreCase: true })
    expect(ops(result)).toEqual(['equal'])
  })

  it('ignores indentation when asked', () => {
    const result = diffText('    return x\n', '\t\treturn x\n', { ignoreLeadingWhitespace: true })
    expect(ops(result)).toEqual(['equal'])
  })

  it('keeps the real line numbers when blank lines are ignored', () => {
    const a = 'one\n\n\ntwo\n'
    const b = 'one\ntwo\n'
    const result = diffText(a, b, { ignoreBlankLines: true })

    expect(result.stats.removed).toBe(0)
    expect(result.stats.similarity).toBe(1)
    expectFaithfulAlignment(result, a, b)
  })
})

describe('tokenizer', () => {
  it('keeps identifiers, numbers and non-ASCII text in one piece', () => {
    const line = 'const åäö1 = "😀"'
    const values = tokenize(line).map((token) => line.slice(token.start, token.end))

    expect(values).toContain('const')
    expect(values).toContain('åäö1')
    expect(values).toContain('😀')
    expect(values.join('')).toBe(line)
  })
})

describe('robustness', () => {
  it('does not hang on one very long line', () => {
    const a = `${'x'.repeat(60_000)}\n`
    const b = `${'y'.repeat(60_000)}\n`

    const started = Date.now()
    const result = diffText(a, b)

    expect(Date.now() - started).toBeLessThan(3000)
    expect((result.lines[0] as DiffLine).words).toBeNull()
  })

  it('compares ten thousand lines quickly enough to feel instant', () => {
    const lines: string[] = []
    for (let i = 0; i < 10_000; i++) {
      const kind = i % 5
      if (kind === 0) lines.push(`function fn${i}(a, b) {`)
      else if (kind === 1) lines.push(`  const value${i} = a * ${i} + b`)
      else if (kind === 2) lines.push('  }')
      else if (kind === 3) lines.push('')
      else lines.push(`  return value${i}`)
    }

    const changed = lines.slice()
    for (let i = 0; i < 500; i++) changed[i * 19] = `${changed[i * 19]} // touched`

    const started = Date.now()
    const result = diffText(lines.join('\n'), changed.join('\n'))

    // Measured at roughly 60 ms; the limit is loose enough not to be flaky in CI
    // but tight enough to catch an accidental quadratic.
    expect(Date.now() - started).toBeLessThan(1000)
    expect(result.stats.changed).toBe(500)
  })

  it('stays faithful across randomly generated edits', () => {
    let seed = 12345
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    const vocabulary = ['{', '}', 'return x', 'if (a) {', 'const b = 2', '', '  // note', 'end']

    for (let round = 0; round < 60; round++) {
      const aLines: string[] = []
      const length = 1 + Math.floor(random() * 40)
      for (let i = 0; i < length; i++) {
        aLines.push(vocabulary[Math.floor(random() * vocabulary.length)] as string)
      }

      const bLines = aLines.slice()
      const edits = Math.floor(random() * 8)
      for (let i = 0; i < edits; i++) {
        const at = Math.floor(random() * (bLines.length + 1))
        if (random() < 0.5 && bLines.length > 0) {
          bLines.splice(Math.min(at, bLines.length - 1), 1)
        } else {
          bLines.splice(at, 0, vocabulary[Math.floor(random() * vocabulary.length)] as string)
        }
      }

      const a = aLines.join('\n')
      const b = bLines.join('\n')
      expectFaithfulAlignment(diffText(a, b), a, b)
    }
  })
})

describe('similarity', () => {
  it('is 1 for identical text and 0 for nothing in common', () => {
    expect(similarity('a\nb\n', 'a\nb\n')).toBe(1)
    expect(similarity('aaa\nbbb\n', 'xxx\nyyy\n')).toBeLessThan(0.2)
  })

  it('is symmetric', () => {
    const a = 'one\ntwo\nthree\n'
    const b = 'one\ntwo point five\nthree\nfour\n'
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10)
  })
})
