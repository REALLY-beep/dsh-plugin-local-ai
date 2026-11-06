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

test('every exported Remote method has Host parameter names matching its Client descriptor', async () => {
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  const exposed = [
    'getState', 'refreshModels', 'saveSettings', 'scanDirectory', 'addModel',
    'removeModel', 'saveModelOptions', 'start', 'stop', 'testEngine',
    'registerModel', 'searchHub', 'downloadHubModel', 'cancelDownload',
  ]
  for (const method of exposed) {
    const clientMatch = client.match(new RegExp(`descriptor\\('${method}', \\[([^\\]]*)\\]\\)`))
    assert.ok(clientMatch, `Client descriptor for ${method} must exist`)
    const clientNames = clientMatch[1]
      .split(',')
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)

    const hostMatch = host.match(new RegExp(`async\\s+${method}\\s*\\(([^)]*)\\)\\s*\\{`))
    assert.ok(hostMatch, `Host method ${method} must exist`)
    const hostNames = hostMatch[1].trim() ? hostMatch[1].split(',').map((part) => part.trim()) : []
    assert.ok(hostNames.every((name) => /^[A-Za-z_$][\w$]*$/.test(name)), `${method} must use plain identifier parameters`)
    assert.deepEqual(hostNames, clientNames, `${method}: Host arguments must match Client descriptor wire fields in order`)
  }
})


test('Hugging Face panel contains minimal catalogue search, sorting and file selection', async () => {
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.match(client, /descriptor\('searchHub', \[\s*'query', 'sort', 'paramsRange', 'weightRange'\s*\]\)/)
  assert.match(client, /Недавно обновлённые/)
  assert.match(client, /Количество параметров/)
  assert.match(client, /Размер GGUF-файла/)
  assert.match(client, /Выбранный GGUF/)
  assert.match(client, /Параметры: \$\{parameterLabel\}/)
  assert.match(client, /Файл модели/)
  assert.match(client, /downloadHubModel', repo\.id, selectedFileInfo\.name/)
  assert.match(client, /mmproj/)
})
