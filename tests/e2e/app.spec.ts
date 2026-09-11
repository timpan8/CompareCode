import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const PAGE_URL = pathToFileURL(resolve('dist/CompareCode.html')).href

// Long enough that most of it is untouched, which is what folding is for.
const before = Array.from({ length: 12 }, (_, i) => `  const rate${i} = ${i} / 100`)
const after = Array.from({ length: 12 }, (_, i) => `  const label${i} = "row ${i}"`)

const sample = (total: string): string =>
  ['function total(items) {', ...before, '  let sum = 0', '  for (const item of items) {', `    ${total}`, '  }', ...after, '  return sum', '}'].join('\n')

const OLD_CODE = sample('sum += item.price')
const NEW_CODE = sample('sum += item.price * item.quantity')

const leftBox = (page: Page) => page.getByRole('textbox').first()
const rightBox = (page: Page) => page.getByRole('textbox').nth(1)

test.beforeEach(async ({ page }) => {
  // A fresh profile every time, so autosave from an earlier test cannot leak in.
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* storage may be unavailable; the app copes either way */
    }
  })
})

test('the new code always ends up on the right, whichever side it was pasted into', async ({
  page,
}) => {
  await page.goto(PAGE_URL)

  // Paste the NEW version first, into the LEFT pane — the situation that makes
  // this confusing everywhere else.
  await leftBox(page).fill(NEW_CODE)
  await page.getByRole('button', { name: 'This is the NEW code' }).click()

  await expect(page.getByTestId('pane-right')).toHaveAttribute('data-role', 'new')
  await expect(page.getByTestId('pane-left')).toHaveAttribute('data-role', 'old')
  await expect(rightBox(page)).toHaveValue(NEW_CODE)
  await expect(leftBox(page)).toHaveValue('')

  // The text that was entered first is still marked as such after moving sides.
  await expect(page.getByTestId('pane-right')).toHaveAttribute('data-paste-order', '1')
  await expect(page.getByTestId('pane-right').getByText('pasted 1st')).toBeVisible()

  // The second text is never asked about: its role follows from the first.
  await leftBox(page).fill(OLD_CODE)
  await expect(page.getByTestId('pane-left')).toHaveAttribute('data-role', 'old')
  await expect(page.getByTestId('pane-left')).toHaveAttribute('data-paste-order', '2')
  await expect(page.getByRole('button', { name: /This is the/ })).toHaveCount(0)
})

test('shows which word changed', async ({ page }) => {
  await page.goto(PAGE_URL)

  await leftBox(page).fill(OLD_CODE)
  await page.getByRole('button', { name: 'This is the OLD code' }).click()
  await rightBox(page).fill(NEW_CODE)

  await page.getByRole('button', { name: 'Compare', exact: true }).click()

  await expect(page.getByText('1 changed')).toBeVisible()
  await expect(page.locator('.word').first()).toBeVisible()
  await expect(page.locator('.cell.is-add').filter({ hasText: 'item.quantity' }).first()).toBeVisible()

  // Unchanged code is folded away, leaving the change easy to find.
  await expect(page.getByRole('button', { name: /unchanged lines/ }).first()).toBeVisible()
})

test('never makes a single network request', async ({ page }) => {
  const attempted: string[] = []

  page.on('request', (request) => {
    const url = request.url()
    if (url !== PAGE_URL && !url.startsWith('data:')) attempted.push(url)
  })

  // Replace every network entry point with something that records and throws, so
  // even a call that never reaches the wire is caught.
  await page.addInitScript(() => {
    const record = (name: string) => {
      return (...args: unknown[]): never => {
        const store = (window as unknown as { __network?: string[] }).__network ?? []
        store.push(`${name}(${String(args[0] ?? '')})`)
        ;(window as unknown as { __network?: string[] }).__network = store
        throw new Error(`blocked: ${name}`)
      }
    }

    window.fetch = record('fetch') as unknown as typeof fetch
    window.XMLHttpRequest = record('XMLHttpRequest') as unknown as typeof XMLHttpRequest
    window.WebSocket = record('WebSocket') as unknown as typeof WebSocket
    window.EventSource = record('EventSource') as unknown as typeof EventSource
    Object.defineProperty(navigator, 'sendBeacon', {
      value: record('sendBeacon'),
      configurable: true,
    })
  })

  await page.goto(PAGE_URL)

  // A complete, ordinary session: paste, mark, compare, switch views, copy.
  await leftBox(page).fill(OLD_CODE)
  await page.getByRole('button', { name: 'This is the OLD code' }).click()
  await rightBox(page).fill(NEW_CODE)
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('button', { name: 'Inline' }).click()
  await page.getByRole('button', { name: /unchanged lines/ }).first().click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Ignore indentation').check()
  await page.getByRole('button', { name: 'Edit text' }).click()

  expect(attempted).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __network?: string[] }).__network ?? [])).toEqual([])
})

test('keeps working with storage unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked')
      },
    })
  })

  await page.goto(PAGE_URL)
  await leftBox(page).fill(OLD_CODE)
  await page.getByRole('button', { name: 'This is the OLD code' }).click()
  await rightBox(page).fill(NEW_CODE)
  await page.getByRole('button', { name: 'Compare', exact: true }).click()

  await expect(page.getByText('1 changed')).toBeVisible()
})
