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
  assert.deepEqual(parameters, ['filePath', 'displayName', 'mmprojPath'])
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
    'getState', 'refreshModels', 'saveSettings', 'scanDirectory', 'addModel', 'saveModelMmproj',
    'removeModel', 'saveModelOptions', 'start', 'stop', 'testEngine', 'testVision',
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


test('provider registration is verified after mutation and avoids unverified reasoning claims', async () => {
  const source = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const body = source.slice(source.indexOf('  async registerModel(id) {'), source.indexOf('  async searchHub('))
  assert.match(body, /this\.ctx\.settings\.mutate/)
  assert.match(body, /const updated = this\.ctx\.settings\.describe\(\)/)
  assert.match(body, /updatedProvider\.models/)
  assert.match(body, /DSH не подтвердил регистрацию модели/)
  assert.match(body, /const visionVerified = await this\.hasCurrentVisionVerification\(model\)/)
  assert.match(body, /input: visionVerified \? \['text', 'image'\] : \['text'\]/)
  assert.doesNotMatch(body, /reasoningEfforts/)
})

test('downloadHubModel carries Hugging Face capability metadata into the local model', async () => {
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.match(host, /async\s+downloadHubModel\(repoId, filename, repoMetadata\)/)
  assert.match(host, /sanitizeHubRepositoryMetadata\(/)
  assert.match(client, /descriptor\('downloadHubModel', \['repoId', 'filename', 'repoMetadata'\]\)/)
  assert.match(client, /selectedFileInfo\.name, \{[\s\S]*?mmprojFilename: selectedProjectorInfo/)
})

test('model catalogue displays capability hints and distinguishes Hub claims from local load verification', async () => {
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.match(client, /function capabilityChips/)
  assert.match(client, /function compatibilityChip/)
  assert.match(client, /Загружалась в llama\.cpp/)
  assert.match(client, /llama\.cpp не подтверждён/)
  assert.match(client, /state\.registeredModelId/)
  assert.match(client, /создай новый чат либо выбери её заново/)
})


test('capability badges distinguish plugin support levels and show exact model IDs', async () => {
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  const logic = await fs.readFile(path.join(root, 'lib/logic.js'), 'utf8')
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  assert.match(logic, /export function withCapabilitySupport/)
  assert.match(client, /is-\$\{status\}/)
  assert.match(client, /ID: \$\{model\.id\}/)
  assert.match(client, /no configured model <ID>/)
  assert.match(client, /dlwb-capability-legend/)
  assert.match(host, /withCapabilitySupport\(model\)/)
  assert.match(host, /filteredModels\.map\(\(model\) => withCapabilitySupport\(model\)\)/)
  assert.match(logic, /vision: \{ status: 'conditional'/)
  assert.match(logic, /tools: \{ status: 'conditional'/)
  assert.match(logic, /embeddings: \{ status: 'unsupported'/)
})


test('Vision is only declared to DSH after a real image-input probe and an attached projector', async () => {
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const body = host.slice(host.indexOf('  async registerModel(id) {'), host.indexOf('  async searchHub('))
  assert.match(body, /const visionVerified = await this\.hasCurrentVisionVerification\(model\)/)
  assert.match(body, /input: visionVerified \? \['text', 'image'\] : \['text'\]/)
  assert.match(host, /async testVision\(\)/)
  assert.match(host, /\/v1\/chat\/completions/)
  assert.match(host, /image_url/)
  assert.match(host, /await this\.registerModel\(model\.id\)/)
  assert.match(host, /async inspectRuntimeModalities\(model\)/)
  assert.match(host, /async collectVisionFingerprint\(model, executablePath\)/)
  assert.match(host, /async hasCurrentVisionVerification\(model\)/)
  assert.match(host, /async invalidateStaleVisionVerification\(model\)/)
  assert.match(host, /visionVerification = await this\.collectVisionFingerprint/)
})

test('Hugging Face bundle download is revision-pinned and atomic with per-file size verification', async () => {
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const client = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.match(host, /buildHubDownloadPlan\(filename, metadataInput\)/)
  assert.match(host, /buildHubDownloadUrl\(safeRepo, safeName, revision\)/)
  assert.match(host, /stat\.size !== file\.sizeBytes/)
  assert.match(host, /await fsp\.rename\(tempFolder, destinationFolder\)/)
  assert.match(host, /await fsp\.rm\(tempFolder, \{ recursive: true, force: true \}\)/)
  assert.match(client, /mmprojFilename: selectedProjectorInfo \? selectedProjectorInfo\.name : ''/)
  assert.match(client, /downloadFiles: mainDownloadFiles/)
  assert.match(client, /selectedFileInfo\.shardCount/)
  assert.match(host, /async fetchHubTreeInventory\(repoId, revision\)/)
  assert.match(host, /getNextHubTreePageUrl\(response\.headers\.get\('link'\)/)
})


test('getState does not expose host-side Vision fingerprints or local engine paths to the client', async () => {
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const stateBody = host.slice(host.indexOf('  async getState() {'), host.indexOf('  async saveSettings('))
  assert.match(stateBody, /visionVerification:\s*undefined/)
  assert.match(host, /modelPath: path\.resolve\(model\.path\)/)
  assert.match(host, /enginePath: path\.resolve\(executablePath\)/)
})


test('model library scanner ignores uncommitted temporary HF download folders', async () => {
  const scanner = await fs.readFile(path.join(root, 'lib/model-scanner.js'), 'utf8')
  assert.match(scanner, /entry\.name\.startsWith\('\.download-'\)/)
})
