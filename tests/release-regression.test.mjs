import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Remote addModel uses SRC-compatible positional identifier parameters', async () => {
  const source = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const match = source.match(/async\s+addModel\s*\(([^)]*)\)\s*\{/)
  assert.ok(match, 'addModel method declaration must exist')
  const parameters = match[1].split(',').map((value) => value.trim())
  assert.deepEqual(parameters, ['filePath', 'displayName'])
  assert.ok(parameters.every((value) => /^[A-Za-z_$][\w$]*$/.test(value)), 'parameters must be simple identifiers without defaults, destructuring, or rest')
  assert.match(source, /cleanString\(displayName\)/, 'missing display name must be normalized inside the method body')
})

test('Local AI panel and long scan-results page have working scroll containers', async () => {
  const source = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  const cssMatch = source.match(/const CSS = `([\s\S]*?)`\s*\n\s*function Icon/)
  assert.ok(cssMatch, 'panel CSS block must exist')
  const css = cssMatch[1]
  assert.match(css, /\.dlwb\s*\{[^}]*height:\s*100%/s)
  assert.match(css, /\.dlwb\s*\{[^}]*min-height:\s*0/s)
  assert.match(css, /\.dlwb\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(css, /\.dlwb-file-list\s*\{[^}]*display:\s*flex/s, 'scan results must remain in normal document flow so the panel scrollbar can reach every result')
})
