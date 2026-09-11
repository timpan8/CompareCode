import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain ESM script, deliberately untyped
import { ALLOWED_URLS, auditHtml, auditScript } from '../scripts/audit-bundle.mjs'

/**
 * The offline audit is the thing standing between "we promise nothing is sent"
 * and it actually being true, so it gets tested like anything else: feed it a
 * page that misbehaves and it has to say so.
 */

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"

const page = (body: string, csp = CSP): string =>
  `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body>${body}</body></html>`

const audit = (html: string): string[] => auditHtml(html, 'test') as string[]

describe('offline audit', () => {
  it('passes a page that only does local work', () => {
    expect(audit(page('<script>const total = 1 + 1; document.title = String(total)</script>'))).toEqual([])
  })

  it.each([
    ['fetch', 'fetch("/x")'],
    ['XMLHttpRequest', 'new XMLHttpRequest()'],
    ['WebSocket', 'new WebSocket("wss://x")'],
    ['EventSource', 'new EventSource("/x")'],
    ['sendBeacon', 'navigator.sendBeacon("/x", "y")'],
    ['dynamic import', 'import("./x.js")'],
    ['a service worker', 'navigator.serviceWorker.register("/sw.js")'],
    ['an absolute URL', 'const home = "https://example.com/collect"'],
  ])('catches %s', (_name, code) => {
    expect(audit(page(`<script>${code}</script>`)).length).toBeGreaterThan(0)
  })

  it('catches an aliased network call', () => {
    expect(auditScript('const send = fetch; send("/x")').length).toBeGreaterThan(0)
  })

  it('catches an absolute URL hidden in a template string', () => {
    expect(auditScript('const u = `https://example.com/${id}`').length).toBeGreaterThan(0)
  })

  it('catches external resources in the markup', () => {
    expect(audit(page('<link rel="stylesheet" href="https://fonts.example/x.css">')).length).toBeGreaterThan(0)
    expect(audit(page('<script src="https://cdn.example/x.js"></script>')).length).toBeGreaterThan(0)
    expect(audit(page('<img src="https://tracker.example/pixel.gif">')).length).toBeGreaterThan(0)
  })

  it('rejects a module script, which would not run from a local file', () => {
    expect(audit(page('<script type="module">const a = 1</script>')).length).toBeGreaterThan(0)
  })

  it('insists on a policy that actually blocks connections', () => {
    expect(audit(page('<script>const a = 1</script>', "default-src 'self'"))).toEqual(
      expect.arrayContaining([expect.stringContaining("connect-src 'none'")]),
    )
    expect(auditHtml('<html><head></head><body></body></html>', 'test')).toEqual(
      expect.arrayContaining([expect.stringContaining('no Content-Security-Policy')]),
    )
  })

  it('allows the handful of URLs that are written down, and nothing else', () => {
    expect(ALLOWED_URLS).toContain('https://github.com/timpan8/CompareCode')
    expect(audit(page('<script>const ns = "http://www.w3.org/2000/svg"</script>'))).toEqual([])
    expect(audit(page('<script>const ns = "http://www.w3.org/2000/other"</script>')).length).toBeGreaterThan(0)
  })
})
