import { render } from 'preact'
import { App } from './ui/App'
import './ui/theme.css'

/**
 * The bundle is a classic script, not a module, because module scripts do not run
 * at all when the page is opened straight from disk. Classic scripts are not
 * deferred either, so wait for the document before mounting rather than assuming
 * the container is already there.
 */
function mount(): void {
  const root = document.getElementById('app')
  if (root === null) {
    console.error('CompareCode: #app is missing from the page')
    return
  }
  render(<App />, root)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
