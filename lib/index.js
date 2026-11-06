import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { scanGgufDirectory } from './model-scanner.js'
import { Readable, Transform } from 'node:stream'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  DEFAULT_MODEL_OPTIONS,
  DEFAULT_SETTINGS,
  buildHubDownloadUrl,
  buildServerArgs,
  cleanString,
  describeModelFile,
  normalizeModelOptions,
  normalizeSettings,
  safeHubFilename,
  safeHubRepoId,
} from './logic.js'

const SERVICE_KEY = 'localAIWorkbench'
const PROVIDER_KEY = 'dsh-local-ai'
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const CONFIG_FILE = 'local-ai-workbench.json'
const MAX_HUB_SEARCH_RESULTS = 12
const MAX_LOG_LENGTH = 12000

function configPath() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, CONFIG_FILE)
}

function ensureInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target))
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))
}

function safeError(error) {
  return error && typeof error.message === 'string' ? error.message : String(error)
}

function markRemote(prototype, methods) {
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze(methods.map((method) => Object.freeze({
        method,
        invocation: Object.freeze({ kind: 'direct' }),
      }))),
    }),
  })
}

function tailFromHandle(handle) {
  if (!handle || !handle.collected) return ''
  let text = ''
  for (const streamName of ['stdout', 'stderr']) {
    try {
      const stream = handle.collected[streamName]
      if (stream) text += stream.readFrom(0).text || ''
    } catch { /* the process may already have closed its output stream */ }
  }
  return text.slice(-MAX_LOG_LENGTH)
}

function sanitizeSearchResult(data) {
  if (!Array.isArray(data)) return []
  return data.slice(0, MAX_HUB_SEARCH_RESULTS).map((item) => {
    const siblings = Array.isArray(item.siblings) ? item.siblings : []
    const files = siblings
      .map((file) => typeof file === 'string' ? file : file && file.rfilename)
      .filter((name) => typeof name === 'string' && /\.gguf$/i.test(name) && !/mmproj/i.test(name))
      .slice(0, 40)
    return {
      id: cleanString(item.id || item.modelId),
      author: cleanString(item.author),
      downloads: Number(item.downloads) || 0,
      likes: Number(item.likes) || 0,
      pipelineTag: cleanString(item.pipeline_tag),
      files,
    }
  }).filter((item) => item.id && item.files.length)
}

class LocalAIWorkbenchService extends TypertRemoteService {
  static inject = ['subprocess', 'settings']

  constructor(ctx) {
    super(ctx, SERVICE_KEY)
    this.ctx = ctx
    this.settings = this.loadConfig()
    this.models = []
    this.hiddenModelIds = new Set()
    this.status = 'stopped'
    this.activeModelId = null
    this.process = null
    this.startGeneration = 0
    this.lastError = null
    this.logTail = ''
    this.startedAt = null
    this.download = null
    this.downloadController = null
    this.lastHealth = null
    this.loadModelCatalog().then(() => this.refreshModelsFromDisk()).catch((error) => this.note('Initial model scan failed', error))
    ctx.effect(() => () => {
      this.cancelDownload().catch(() => {})
      if (this.process) {
        try { this.process.terminate() } catch { /* already gone */ }
        this.process = null
      }
    })
  }

  loadConfig() {
    const defaults = {
      ...DEFAULT_SETTINGS,
      modelsDir: path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'models'),
    }
    try {
      const stored = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
      return normalizeSettings(stored, defaults)
    } catch {
      return normalizeSettings({}, defaults)
    }
  }

  async persistConfig() {
    const target = configPath()
    await fsp.mkdir(path.dirname(target), { recursive: true })
    const tmp = `${target}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(this.settings, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    await fsp.rename(tmp, target)
  }

  note(message, error) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}${error ? `: ${safeError(error)}` : ''}`
    this.logTail = `${this.logTail}\n${line}`.slice(-MAX_LOG_LENGTH)
    console.info(`[dsh-local-ai-workbench] ${line}`)
  }

  async refreshModels() {
    await this.refreshModelsFromDisk()
    return this.getState()
  }

  async getState() {
    if (this.process) this.logTail = tailFromHandle(this.process) || this.logTail
    return {
      settings: { ...this.settings, apiKey: this.settings.apiKey ? '••••••••' : '' },
      models: this.models.map((model) => ({ ...model, path: undefined })),
      status: this.status,
      activeModelId: this.activeModelId,
      lastError: this.lastError,
      logTail: this.logTail.slice(-6000),
      startedAt: this.startedAt,
      download: this.download ? { status: this.download.status, repoId: this.download.repoId, filename: this.download.filename, downloadedBytes: this.download.downloadedBytes, totalBytes: this.download.totalBytes, progress: this.download.progress, error: this.download.error } : null,
      lastHealth: this.lastHealth,
    }
  }

  async saveSettings(input) {
    const src = input && typeof input === 'object' ? input : {}
    const apiKey = src.apiKey === '••••••••' ? this.settings.apiKey : cleanString(src.apiKey)
    this.settings = normalizeSettings({ ...src, apiKey }, this.settings)
    if (this.settings.modelsDir) await fsp.mkdir(this.settings.modelsDir, { recursive: true })
    await this.persistConfig()
    await this.refreshModelsFromDisk()
    this.note('Settings saved')
    return { ok: true }
  }

  async loadModelCatalog() {
    const catalogPath = path.join(path.dirname(configPath()), 'local-ai-models.json')
    try {
      const raw = JSON.parse(await fsp.readFile(catalogPath, 'utf8'))
      const records = Array.isArray(raw) ? raw : (Array.isArray(raw.models) ? raw.models : [])
      this.hiddenModelIds = new Set(Array.isArray(raw && raw.hiddenIds) ? raw.hiddenIds.filter((id) => typeof id === 'string') : [])
      const restored = []
      for (const record of records) {
        if (!record || typeof record.path !== 'string' || !/\.gguf$/i.test(record.path) || /mmproj/i.test(record.path)) continue
        try {
          const stat = await fsp.stat(record.path)
          if (!stat.isFile()) continue
          const fresh = describeModelFile(record.path, stat.size, record.name)
          restored.push({ ...fresh, id: typeof record.id === 'string' ? record.id : fresh.id, addedAt: record.addedAt || fresh.addedAt, options: normalizeModelOptions(record.options) })
        } catch { /* ignore catalog items whose files were moved or deleted */ }
      }
      this.models = restored
    } catch (error) {
      if (error && error.code !== 'ENOENT') this.note('Model catalog could not be read', error)
    }
  }

  async refreshModelsFromDisk() {
    if (!this.settings.modelsDir) return this.models
    await fsp.mkdir(this.settings.modelsDir, { recursive: true })
    const scan = await scanGgufDirectory(this.settings.modelsDir)
    const discovered = []
    for (const file of scan.files) {
      const fullPath = file.path
      const existing = this.models.find((model) => path.resolve(model.path) === path.resolve(fullPath))
      const model = describeModelFile(fullPath, file.sizeBytes, existing && existing.name)
      if (this.hiddenModelIds.has(model.id)) continue
      discovered.push({ ...model, options: existing ? existing.options : { ...DEFAULT_MODEL_OPTIONS }, addedAt: existing ? existing.addedAt : model.addedAt })
    }
    const unreadableDirectories = scan.skippedDirectoryPaths || []
    const preservedFromUnreadableDirectories = this.models.filter((model) =>
      !this.hiddenModelIds.has(model.id) && unreadableDirectories.some((directory) => ensureInside(directory, model.path))
    )
    const custom = this.models.filter((model) => !ensureInside(this.settings.modelsDir, model.path) && !this.hiddenModelIds.has(model.id))
    const merged = new Map([...discovered, ...preservedFromUnreadableDirectories, ...custom].map((model) => [model.id, model]))
    this.models = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
    return this.models
  }

  async scanDirectory(dir) {
    return scanGgufDirectory(cleanString(dir))
  }

  async addModel(filePath, displayName) {
    const resolved = path.resolve(cleanString(filePath))
    if (!/\.gguf$/i.test(resolved) || /mmproj/i.test(path.basename(resolved))) {
      throw new Error('Выбери файл модели .gguf, а не mmproj-проектор.')
    }
    const stat = await fsp.stat(resolved)
    if (!stat.isFile()) throw new Error('Путь должен вести к файлу GGUF.')
    const entry = describeModelFile(resolved, stat.size, cleanString(displayName))
    const existing = this.models.find((model) => model.id === entry.id)
    const model = { ...entry, options: existing ? existing.options : { ...DEFAULT_MODEL_OPTIONS } }
    this.hiddenModelIds.delete(model.id)
    this.models = [...this.models.filter((item) => item.id !== model.id), model].sort((a, b) => a.name.localeCompare(b.name))
    await this.persistModelCatalog()
    this.note(`Model added: ${model.name}`)
    return { ...model, path: undefined }
  }

  async persistModelCatalog() {
    // The list is reconstructed from the configured models folder on launch.
    // Custom paths are retained in this catalog so external GGUF files remain available.
    const catalogPath = path.join(path.dirname(configPath()), 'local-ai-models.json')
    const data = { models: this.models.map((m) => ({ ...m, path: m.path })), hiddenIds: [...this.hiddenModelIds] }
    await fsp.mkdir(path.dirname(catalogPath), { recursive: true })
    const tmp = `${catalogPath}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
    await fsp.rename(tmp, catalogPath)
  }

  async removeModel(id) {
    if (this.status !== 'stopped' && this.activeModelId === id) throw new Error('Сначала останови активную модель.')
    this.hiddenModelIds.add(id)
    this.models = this.models.filter((model) => model.id !== id)
    await this.persistModelCatalog()
    // Best-effort cleanup avoids stale entries in DSH's model selector.
    try {
      const desc = this.ctx.settings.describe().find((item) => item.ns === this.settings.settingsNamespace)
      const providers = desc && desc.value && typeof desc.value.providers === 'object' ? desc.value.providers : null
      const prior = providers && providers[PROVIDER_KEY]
      if (desc && prior && Array.isArray(prior.models)) {
        const models = prior.models.filter((entry) => entry && entry.id !== id)
        if (models.length !== prior.models.length) {
          const nextProviders = { ...providers }
          if (models.length) nextProviders[PROVIDER_KEY] = { ...prior, models }
          else delete nextProviders[PROVIDER_KEY]
          await this.ctx.settings.mutate(this.settings.settingsNamespace, [
            { op: 'set', path: ['providers'], value: nextProviders },
          ], desc.revision)
        }
      }
    } catch (error) { this.note(`Could not remove ${id} from DSH provider`, error) }
    return { ok: true }
  }

  async saveModelOptions(id, options) {
    const model = this.models.find((item) => item.id === id)
    if (!model) throw new Error('Модель не найдена в библиотеке.')
    model.options = normalizeModelOptions(options)
    await this.persistModelCatalog()
    return { ok: true, options: model.options }
  }

  async resolveExecutable() {
    const configured = cleanString(this.settings.serverPath)
    if (configured) {
      const resolved = path.resolve(configured)
      let stat
      try { stat = await fsp.stat(resolved) } catch { throw new Error(`Не найден llama.cpp: ${resolved}`) }
      if (stat.isDirectory()) return path.join(resolved, this.settings.serverName)
      return resolved
    }
    const candidates = process.platform === 'win32'
      ? ['llama-server.exe', 'llama-server']
      : ['llama-server']
    for (const candidate of candidates) {
      try { return await this.ctx.subprocess.resolveExecutable(candidate) } catch { /* try next */ }
    }
    throw new Error('Не найден llama-server. Укажи путь к бинарному файлу или папке llama.cpp в Engine settings.')
  }

  getPublishedModelId() {
    const desc = this.ctx.settings.describe().find((item) => item.ns === this.settings.settingsNamespace)
    const provider = desc && desc.value && desc.value.providers && desc.value.providers[PROVIDER_KEY]
    return provider && Array.isArray(provider.models) && provider.models[0] ? provider.models[0].id : null
  }

  buildArgs(model, executable) {
    return buildServerArgs({
      executable,
      modelPath: model.path,
      port: this.settings.port,
      apiKey: this.settings.apiKey,
      options: model.options,
      // Must match the model ID written into DSH's provider config.
      alias: model.id,
    })
  }

  async start(id) {
    if (this.process || this.status === 'starting' || this.status === 'ready') throw new Error('Сервер уже запущен. Сначала останови текущую модель.')
    const model = this.models.find((item) => item.id === id)
    if (!model) throw new Error('Модель не найдена. Обнови библиотеку моделей и попробуй снова.')
    const publishedModelId = this.getPublishedModelId()
    if (publishedModelId && publishedModelId !== id) throw new Error('В DSH сейчас опубликована другая GGUF-модель. Нажми «В DSH» на карточке этой модели и повтори запуск.')
    const generation = ++this.startGeneration
    this.lastError = null
    this.status = 'starting'
    this.activeModelId = model.id
    this.startedAt = new Date().toISOString()
    this.logTail = ''
    let executable
    let argv
    try {
      executable = await this.resolveExecutable()
      if (generation !== this.startGeneration || this.status !== 'starting') return { ok: true, status: 'stopped' }
      argv = this.buildArgs(model, executable)
      const cwd = path.dirname(executable)
      this.note(`Starting ${model.name}`)
      this.process = this.ctx.subprocess.spawn({
        argv,
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 65536 },
          stderr: { maxBytes: 65536 },
        },
        graceMs: 10000,
      })
      const handle = this.process
      handle.done.then((outcome) => {
        if (this.process !== handle) return
        this.logTail = tailFromHandle(handle) || this.logTail
        this.process = null
        this.status = 'stopped'
        this.activeModelId = null
        this.startedAt = null
        this.note(`llama-server exited${outcome && outcome.exitCode != null ? ` (code ${outcome.exitCode})` : ''}`)
      }, (error) => {
        if (this.process !== handle) return
        this.logTail = tailFromHandle(handle) || this.logTail
        this.process = null
        this.status = 'error'
        this.activeModelId = null
        this.startedAt = null
        this.lastError = safeError(error)
        this.note('llama-server process failed', error)
      })
      this.waitForHealth(handle).catch((error) => {
        if (this.process !== handle || this.status === 'stopping') return
        this.status = 'error'
        this.lastError = safeError(error)
        this.note('Server did not become ready', error)
        try { handle.terminate() } catch { /* ignored */ }
      })
      return { ok: true, status: 'starting' }
    } catch (error) {
      if (generation !== this.startGeneration) return { ok: true, status: 'stopped' }
      this.status = 'error'
      this.activeModelId = null
      this.startedAt = null
      this.lastError = safeError(error)
      this.note('Could not start llama-server', error)
      throw error
    }
  }

  async waitForHealth(handle) {
    const deadline = Date.now() + 120000
    let lastError = null
    while (Date.now() < deadline && this.process === handle && this.status !== 'stopping') {
      try {
        const headers = this.settings.apiKey ? { Authorization: `Bearer ${this.settings.apiKey}` } : {}
        const response = await fetch(`http://127.0.0.1:${this.settings.port}/health`, { headers, signal: AbortSignal.timeout(2500) })
        if (response.ok) {
          this.status = 'ready'
          this.lastHealth = new Date().toISOString()
          this.note('llama-server is ready')
          return
        }
        lastError = new Error(`HTTP ${response.status}`)
      } catch (error) { lastError = error }
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    if (this.process === handle && this.status !== 'stopping') {
      throw new Error(`Тайм-аут ожидания llama-server на порту ${this.settings.port}. ${lastError ? safeError(lastError) : ''}`)
    }
  }

  async stop() {
    const handle = this.process
    if (!handle) {
      if (this.status === 'starting') {
        this.startGeneration += 1
        this.status = 'stopped'
        this.activeModelId = null
        this.startedAt = null
        this.note('Startup cancelled')
      } else if (this.status !== 'error') this.status = 'stopped'
      return { ok: true }
    }
    this.status = 'stopping'
    this.note('Stopping llama-server')
    try { handle.terminate() } catch { /* the process may already have exited */ }
    await Promise.race([
      handle.done.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ])
    if (this.process === handle) {
      this.process = null
      this.status = 'stopped'
      this.activeModelId = null
      this.startedAt = null
    }
    return { ok: true }
  }

  async testEngine() {
    const headers = this.settings.apiKey ? { Authorization: `Bearer ${this.settings.apiKey}` } : {}
    try {
      const response = await fetch(`http://127.0.0.1:${this.settings.port}/health`, { headers, signal: AbortSignal.timeout(3000) })
      const text = await response.text()
      return { ok: response.ok, status: response.status, response: text.slice(0, 500) }
    } catch (error) {
      return { ok: false, error: safeError(error) }
    }
  }

  async registerModel(id) {
    const model = this.models.find((item) => item.id === id)
    if (!model) throw new Error('Модель не найдена.')
    if (this.status !== 'stopped' && this.activeModelId !== id) throw new Error('Сначала останови другую активную модель. В этой версии одновременно обслуживается одна GGUF-модель.')
    const desc = this.ctx.settings.describe().find((item) => item.ns === this.settings.settingsNamespace)
    if (!desc) throw new Error(`Не найден namespace настроек ${this.settings.settingsNamespace}. Проверь, установлен ли провайдер llm-pi-ai.`)
    const current = desc.value && typeof desc.value === 'object' && desc.value.providers && typeof desc.value.providers === 'object'
      ? desc.value.providers : {}
    const providers = { ...current }
    const prior = providers[PROVIDER_KEY] && typeof providers[PROVIDER_KEY] === 'object' ? providers[PROVIDER_KEY] : {}
    // llama-server serves one loaded GGUF model; publish only that model to avoid
    // exposing inactive library entries as selectable-but-misrouted DSH models.
    const models = []
    const ctx = model.options.contextSize
    models.push({
      id: model.id,
      name: model.name,
      contextWindow: ctx,
      maxTokens: Math.max(256, Math.floor(ctx / 4)),
      reasoningEfforts: { off: 'none', low: 'low', medium: 'medium', high: 'high' },
    })
    providers[PROVIDER_KEY] = {
      ...prior,
      displayName: 'Local AI (llama.cpp)',
      api: 'openai-completions',
      baseURL: `http://127.0.0.1:${this.settings.port}/v1`,
      headers: { ...(prior.headers || {}), authorization: `Bearer ${this.settings.apiKey || 'dsh-local-ai'}` },
      defaultInput: ['text'],
      reasoning: 'high',
      models,
    }
    await this.ctx.settings.mutate(this.settings.settingsNamespace, [
      { op: 'set', path: ['providers'], value: providers },
    ], desc.revision)
    this.note(`Registered ${model.name} in DSH model list`)
    return { ok: true, provider: PROVIDER_KEY, modelId: model.id }
  }

  async searchHub(query) {
    const q = cleanString(query)
    if (!q) throw new Error('Введи название модели для поиска.')
    const url = new URL('https://huggingface.co/api/models')
    url.searchParams.set('search', q)
    url.searchParams.set('filter', 'gguf')
    url.searchParams.set('limit', String(MAX_HUB_SEARCH_RESULTS))
    url.searchParams.set('sort', 'downloads')
    url.searchParams.set('direction', '-1')
    url.searchParams.set('blobs', 'true')
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Hugging Face API вернул HTTP ${response.status}.`)
    const data = await response.json()
    return sanitizeSearchResult(data)
  }

  async downloadHubModel(repoId, filename) {
    if (this.download && this.download.status === 'downloading') throw new Error('Загрузка уже выполняется. Дождись её завершения или отмени.')
    const safeRepo = safeHubRepoId(repoId)
    const safeFile = safeHubFilename(filename)
    await fsp.mkdir(this.settings.modelsDir, { recursive: true })
    const basename = path.basename(safeFile)
    const destination = path.resolve(this.settings.modelsDir, basename)
    if (!ensureInside(this.settings.modelsDir, destination)) throw new Error('Небезопасный путь сохранения файла.')
    try { await fsp.access(destination); throw new Error(`Файл уже существует: ${destination}. Удали или переименуй его вручную.`) } catch (error) { if (error && error.code !== 'ENOENT') throw error }
    const temp = `${destination}.${createHash('sha1').update(`${safeRepo}/${safeFile}`).digest('hex').slice(0, 8)}.part`
    const controller = new AbortController()
    this.downloadController = controller
    this.download = { status: 'downloading', repoId: safeRepo, filename: safeFile, downloadedBytes: 0, totalBytes: 0, progress: 0, error: null }
    try {
      const response = await fetch(buildHubDownloadUrl(safeRepo, safeFile), {
        redirect: 'follow',
        signal: controller.signal,
        headers: { Accept: 'application/octet-stream' },
      })
      if (!response.ok || !response.body) throw new Error(`Hugging Face вернул HTTP ${response.status}.`)
      const totalBytes = Number(response.headers.get('content-length')) || 0
      this.download.totalBytes = totalBytes
      const counter = new Transform({
        transform: (chunk, encoding, callback) => {
          this.download.downloadedBytes += chunk.length
          this.download.progress = totalBytes ? Math.min(100, Math.round(this.download.downloadedBytes / totalBytes * 100)) : 0
          callback(null, chunk)
        },
      })
      await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(temp, { flags: 'w' }), { signal: controller.signal })
      const stat = await fsp.stat(temp)
      if (!stat.size) throw new Error('Загруженный файл пустой.')
      await fsp.rename(temp, destination)
      this.download = { ...this.download, status: 'complete', progress: 100, destination, downloadedBytes: stat.size }
      await this.refreshModelsFromDisk()
      const added = await this.addModel(destination, basename.replace(/\.gguf$/i, ''))
      this.note(`Downloaded ${safeRepo}/${safeFile}`)
      return { ok: true, model: added }
    } catch (error) {
      await fsp.rm(temp, { force: true }).catch(() => {})
      const cancelled = controller.signal.aborted
      this.download = { ...(this.download || {}), status: cancelled ? 'cancelled' : 'error', error: cancelled ? null : safeError(error) }
      if (!cancelled) this.note('Hugging Face download failed', error)
      if (!cancelled) throw error
      return { ok: false, cancelled: true }
    } finally {
      if (this.downloadController === controller) this.downloadController = null
    }
  }

  async cancelDownload() {
    if (this.downloadController) {
      this.downloadController.abort()
      this.downloadController = null
      return { ok: true }
    }
    return { ok: false }
  }
}

markRemote(LocalAIWorkbenchService.prototype, [
  'getState', 'refreshModels', 'saveSettings', 'scanDirectory', 'addModel', 'removeModel',
  'saveModelOptions', 'start', 'stop', 'testEngine', 'registerModel',
  'searchHub', 'downloadHubModel', 'cancelDownload',
])

export default LocalAIWorkbenchService
