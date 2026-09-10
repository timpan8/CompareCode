#!/usr/bin/env node
/**
 * Proves, mechanically, that the built page cannot phone home.
 *
 * The claim this tool makes to its users — your code never leaves the browser —
 * is only worth something if it is checked rather than asserted. So the release
 * build is parsed and refused if it contains anything that could open a
 * connection: a network API, a dynamic import, an absolute URL, a preconnect
 * hint, a leftover source map reference.
 *
 * The exception list holds exactly two strings, spelled out in full below. It is
 * deliberately not a list of rule names to switch off: every allowed URL has to
 * be written out here where a reviewer will see it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'acorn'
import { simple } from 'acorn-walk'

/**
 * URLs the page is allowed to contain, written out in full so a reviewer can see
 * every one of them. The first three are XML namespace identifiers — strings the
 * DOM compares against, never addresses anything requests. The last is the
 * footer link to this repository, so anyone can go and read the source.
 *
 * Adding an entry here is a deliberate act. If the build starts carrying a URL
 * that is not on this list, the audit fails and someone has to look at why.
 */
export const ALLOWED_URLS = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'https://github.com/timpan8/CompareCode',
]

/** Constructors that can open a connection. */
const BANNED_CONSTRUCTORS = new Set([
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'RTCPeerConnection',
  'RTCDataChannel',
  'SharedWorker',
  'BroadcastChannel',
])

/** Free-standing functions that can open a connection. */
const BANNED_CALLS = new Set(['fetch', 'importScripts'])

/** Members that reach the network however they are called. */
const BANNED_MEMBERS = new Set([
  'sendBeacon',
  'serviceWorker',
  'requestFileSystem',
  'webkitRequestFileSystem',
])

const HTML_PATTERNS = [
  { pattern: /<link[^>]+rel=["']?(preconnect|dns-prefetch|prefetch|preload|modulepreload|stylesheet)/gi, what: 'external resource hint or stylesheet link' },
  { pattern: /sourceMappingURL/gi, what: 'source map reference' },
  { pattern: /@import\s+url\(/gi, what: 'CSS @import' },
  { pattern: /<iframe/gi, what: 'iframe' },
  { pattern: /<script[^>]+\ssrc=/gi, what: 'external script' },
  { pattern: /type=["']module["']/gi, what: 'module script (will not run from file://)' },
]

const REQUIRED_CSP_DIRECTIVES = ["default-src 'none'", "connect-src 'none'", "form-action 'none'"]

/**
 * @param {string} html
 * @param {string} label
 * @returns {string[]} one message per problem found; empty means the file is clean
 */
export function auditHtml(html, label = 'bundle') {
  const problems = []
  const report = (message) => problems.push(`${label}: ${message}`)

  // The policy value contains single quotes ('none'), so match on the delimiter
  // that actually opened the attribute rather than on "any quote".
  const csp = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]+content=(["'])((?:(?!\1)[\s\S])*)\1/i.exec(html)
  if (csp === null) {
    report('no Content-Security-Policy meta tag')
  } else {
    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      if (!csp[2].includes(directive)) report(`Content-Security-Policy is missing "${directive}"`)
    }
  }

  for (const { pattern, what } of HTML_PATTERNS) {
    pattern.lastIndex = 0
    const match = pattern.exec(html)
    if (match !== null) report(`contains ${what} (${truncate(match[0])})`)
  }

  // Any attribute pointing at an absolute URL would be fetched by the browser.
  for (const match of html.matchAll(/(?:src|href|action|formaction)=["']([^"']+)["']/gi)) {
    const value = match[1]
    if (/^(https?:)?\/\//i.test(value) && !ALLOWED_URLS.includes(value)) {
      report(`links to an absolute URL: ${truncate(value)}`)
    }
  }

  for (const script of extractInlineScripts(html)) {
    problems.push(...auditScript(script).map((message) => `${label}: ${message}`))
  }

  return problems
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function auditScript(source) {
  const problems = []
  let tree

  try {
    tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
  } catch (error) {
    return [`inline script could not be parsed: ${error.message}`]
  }

  simple(tree, {
    NewExpression(node) {
      const name = node.callee?.name
      if (name !== undefined && BANNED_CONSTRUCTORS.has(name)) {
        problems.push(`constructs ${name}`)
      }
      if (name === 'Worker') {
        const argument = node.arguments[0]
        const isBlob = argument?.type === 'Identifier' || argument?.type === 'CallExpression'
        if (!isBlob) problems.push('constructs a Worker from a literal URL')
      }
    },
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && BANNED_CALLS.has(node.callee.name)) {
        problems.push(`calls ${node.callee.name}()`)
      }
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        (BANNED_MEMBERS.has(node.callee.property.name) || BANNED_CALLS.has(node.callee.property.name))
      ) {
        problems.push(`calls .${node.callee.property.name}()`)
      }
    },
    ImportExpression() {
      problems.push('uses a dynamic import()')
    },
    MemberExpression(node) {
      if (node.property.type === 'Identifier' && BANNED_MEMBERS.has(node.property.name)) {
        problems.push(`references .${node.property.name}`)
      }
    },
    Identifier(node) {
      if (BANNED_CONSTRUCTORS.has(node.name) || BANNED_CALLS.has(node.name)) {
        problems.push(`references ${node.name}`)
      }
    },
    Literal(node) {
      if (typeof node.value !== 'string') return
      for (const match of node.value.matchAll(/https?:\/\/[^\s"'`)<>]+/gi)) {
        if (!ALLOWED_URLS.includes(match[0])) problems.push(`embeds the URL ${truncate(match[0])}`)
      }
    },
    TemplateElement(node) {
      const raw = node.value?.raw ?? ''
      for (const match of raw.matchAll(/https?:\/\/[^\s"'`)<>]+/gi)) {
        if (!ALLOWED_URLS.includes(match[0])) problems.push(`embeds the URL ${truncate(match[0])}`)
      }
    },
  })

  return [...new Set(problems)]
}

function extractInlineScripts(html) {
  const scripts = []
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim() !== '') scripts.push(match[1])
  }
  return scripts
}

function truncate(value) {
  return value.length > 90 ? `${value.slice(0, 90)}…` : value
}

function main() {
  const target = resolve(process.argv[2] ?? 'dist')
  const files = statSync(target).isDirectory()
    ? readdirSync(target)
        .filter((name) => name.endsWith('.html'))
        .map((name) => join(target, name))
    : [target]

  if (files.length === 0) {
    console.error(`No HTML files found in ${target}. Run the build first.`)
    process.exit(1)
  }

  const problems = []
  for (const file of files) {
    problems.push(...auditHtml(readFileSync(file, 'utf8'), file))
  }

  if (problems.length > 0) {
    console.error('Offline audit FAILED — the build can reach the network:\n')
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    console.error('\nNothing in this app may contact a server. Remove the code above.')
    process.exit(1)
  }

  console.log(`Offline audit passed: no network APIs found in ${files.length} file(s).`)
  for (const file of files) console.log(`  ✓ ${file}`)
}

// Only run the CLI when invoked directly, so the tests can import the functions.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
