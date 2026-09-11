import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `src/core` is the part that future tools reuse — a "differences only" view, a
 * comparison of five files at once, or the same engine running on a worker. That
 * only stays true if it never reaches for the page it happens to be running in.
 *
 * These tests are the fence around that promise.
 */

const CORE = 'src/core'

function coreFiles(directory = CORE): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? coreFiles(path) : path.endsWith('.ts') ? [path] : []
  })
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('core stays pure', () => {
  const files = coreFiles()

  it('finds the core modules', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s touches no browser globals', (file) => {
    const source = withoutComments(readFileSync(file, 'utf8'))
    const forbidden = [
      /\bdocument\s*\./,
      /\bwindow\s*\./,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bnavigator\s*\./,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
    ]

    for (const pattern of forbidden) {
      expect(source, `${file} must not use ${pattern}`).not.toMatch(pattern)
    }
  })

  it.each(files)('%s does not import from the interface', (file) => {
    const source = readFileSync(file, 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*\/ui\//)
    expect(source).not.toMatch(/from\s+['"]preact/)
  })
})
