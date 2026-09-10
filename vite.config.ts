import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * The whole point of this app is that your code never leaves the browser, so the
 * page declares up front that it is not allowed to talk to anything. `connect-src
 * 'none'` is the load-bearing directive: it makes the browser refuse fetch, XHR,
 * WebSocket, EventSource and sendBeacon even if a bug or a future mistake tried.
 * `default-src 'none'` already implies it, but it is spelled out so that loosening
 * the default can never silently open a hole.
 *
 * Scripts and styles are inlined into the single HTML file, hence 'unsafe-inline'.
 * That is an XSS-hardening trade-off, not an egress one — nothing here can reach
 * the network regardless of where the script text came from.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "media-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
].join('; ')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Inlines every emitted chunk and stylesheet into index.html and writes a second
 * copy named CompareCode.html, which is the file you can download and open with
 * no network connection at all.
 *
 * This is deliberately hand-rolled instead of pulling in a single-file plugin: a
 * build dependency is exactly the thing that could quietly introduce the network
 * call this tool promises not to make, and forty lines we own are cheaper to
 * trust than a supply chain we don't.
 */
function selfContainedBuild(): Plugin {
  let outDir = 'dist'

  return {
    name: 'comparecode:self-contained',
    enforce: 'post',
    apply: 'build',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html

        let out = html
        const inlineScripts: string[] = []

        for (const [fileName, item] of Object.entries(ctx.bundle)) {
          const pattern = escapeRegExp(fileName)

          if (item.type === 'chunk') {
            // A closing tag inside a string literal would end the script early.
            inlineScripts.push(item.code.replace(/<\/script/gi, '<\\/script'))
            out = out.replace(
              new RegExp(`<script[^>]*src="[^"]*${pattern}"[^>]*>\\s*</script>`, 'g'),
              '',
            )
            delete ctx.bundle[fileName]
          } else if (fileName.endsWith('.css')) {
            const css = String(item.source)
            out = out.replace(
              new RegExp(`<link[^>]*href="[^"]*${pattern}"[^>]*>`, 'g'),
              () => `<style>${css}</style>`,
            )
            delete ctx.bundle[fileName]
          }
        }

        // A classic script is not deferred, so it has to come after the markup it
        // mounts into. The bundler hoists module scripts into <head>; leaving one
        // there would run it before #app exists and render nothing at all.
        const script = inlineScripts.map((code) => `<script>${code}</script>`).join('\n')
        out = out.includes('</body>')
          ? out.replace('</body>', `${script}\n</body>`)
          : `${out}\n${script}`

        return out.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
        )
      },
    },

    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, 'CompareCode.html'))
    },
  }
}

export default defineConfig({
  // Relative so the same build works on GitHub Pages and straight off the disk.
  base: './',
  // JSX settings (`react-jsx` + `preact`) come from tsconfig.json, which the
  // bundler reads directly — no framework plugin needed.
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
    // A module script is blocked by the browser when the page is opened from
    // file://, which would leave the downloaded copy silently doing nothing.
    modulePreload: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
      },
    },
  },
  plugins: [selfContainedBuild()],
})
