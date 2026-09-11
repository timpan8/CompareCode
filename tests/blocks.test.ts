import { describe, expect, it } from 'vitest'
import { diffText } from '../src/core/diff'
import { buildBlocks } from '../src/ui/blocks'

describe('collapsing unchanged code', () => {
  it('keeps context around a change and folds the rest', () => {
    const hunks = [{ start: 40, end: 42, aStart: 40, aCount: 2, bStart: 40, bCount: 2 }]
    const blocks = buildBlocks(100, hunks, 3, 4)

    expect(blocks).toEqual([
      { kind: 'fold', from: 0, to: 37 },
      { kind: 'lines', from: 37, to: 45 },
      { kind: 'fold', from: 45, to: 100 },
    ])
  })

  it('leaves short gaps alone rather than folding two lines behind a button', () => {
    const hunks = [
      { start: 5, end: 6, aStart: 5, aCount: 1, bStart: 5, bCount: 1 },
      { start: 12, end: 13, aStart: 12, aCount: 1, bStart: 12, bCount: 1 },
    ]
    const blocks = buildBlocks(40, hunks, 3, 4)

    // The two changes are close enough that their context overlaps, and the two
    // leading lines are too few to be worth hiding — so everything up to line 16
    // stays visible as one stretch and only the tail is folded.
    expect(blocks).toEqual([
      { kind: 'lines', from: 0, to: 16 },
      { kind: 'fold', from: 16, to: 40 },
    ])
  })

  it('folds everything when the two versions are identical', () => {
    const result = diffText('a\nb\nc\nd\ne\n', 'a\nb\nc\nd\ne\n')
    expect(buildBlocks(result.lines.length, result.hunks, 3, 4)).toEqual([
      { kind: 'fold', from: 0, to: 5 },
    ])
  })

  it('handles an empty comparison', () => {
    expect(buildBlocks(0, [], 3, 4)).toEqual([])
  })
})
