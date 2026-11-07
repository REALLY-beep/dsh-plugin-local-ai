import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { scanGgufDirectory } from './model-scanner.js'
import { installRuntimeOrientation } from './runtime-orientation.js'
import { installHumanRequestLast } from './request-order.js'
import { readLlamaReasoningCapabilities } from './reasoning.js'
import { readGgufContextMetadata } from './gguf-metadata.js'
import { Readable, Transform } from 'node:stream'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  DEFAULT_MODEL_OPTIONS,
  DEFAULT_SETTINGS,
  buildHubDownloadUrl,
  buildHubDownloadPlan,
  buildHubSearchUrls,
  buildHubSearchQueries,
  buildHubTreeUrl,
  getNextHubTreePageUrl,
  filterHubModelsByWeight,
  mergeHubSearchResults,
  sanitizeHubModels,
  sanitizeHubTreeInventory,
  sanitizeHubRepositoryMetadata,
  withCapabilitySupport,
  buildServerArgs,
  cleanString,
  describeModelFile,
  normalizeModelOptions,
  normalizeSettings,
  estimateKvCacheBytes,
  safeHubFilename,
  safeHubRepoId,
} from './logic.js'

const SERVICE_KEY = 'localAIWorkbench'
const PROVIDER_KEY = 'dsh-local-ai'
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const CONFIG_FILE = 'local-ai-workbench.json'
const MAX_HUB_SEARCH_RESULTS = 24
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



class LocalAIWorkbenchService extends TypertRemoteService {
  static inject = ['subprocess', 'settings', 'systemPrompt']

  constructor(ctx) {
    super(ctx, SERVICE_KEY)
    this.ctx = ctx
    // This system-level orientation frames DSH's machine-generated runtime
    // snapshot as environment metadata, not as a user-authored task.
    ctx.effect(
      () => installRuntimeOrientation(ctx.systemPrompt),
      'local-ai-workbench.runtime-orientation',
    )
    this.settings = this.loadConfig()
    this.models = []
    this.hiddenModelIds = new Set()
    this.status = 'stopped'
    this.activeModelId = null
    this.process = null
    this.activeExecutable = null
    this.startGeneration = 0
    this.lastError = null
    this.logTail = ''
    this.startedAt = null
    this.download = null
    this.downloadController = null
    this.hubFileMetadataCache = new Map()
    this.lastHealth = null
    // Fix DSH's injected-user-context ordering for this local OpenAI-compatible route.
    // Runtime/skill/time messages remain in context; the real user request is kept last.
    const requestOrderingInstalled = installHumanRequestLast(ctx, PROVIDER_KEY, (info) => {
      this.note(`Reordered DSH context before the human request (${info.moved} context message(s), turn ${info.turn}, step ${info.step})`)
    })
    if (!requestOrderingInstalled) this.note('DSH agent/pre-step event is unavailable; local request ordering fix was not installed')
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

  getConfiguredProviderModel() {
    try {
      const desc = this.ctx.settings.describe().find((item) => item.ns === this.settings.settingsNamespace)
      const provider = desc && desc.value && desc.value.providers && desc.value.providers[PROVIDER_KEY]
      const configured = provider && Array.isArray(provider.models) ? provider.models[0] : null
      return configured ? { id: configured.id || null, name: configured.name || configured.id || null } : { id: null, name: null }
    } catch { return { id: null, name: null } }
  }

  async getState() {
    if (this.process) this.logTail = tailFromHandle(this.process) || this.logTail
    const staleVisionModels = []
    for (const model of this.models) {
      if (await this.invalidateStaleVisionVerification(model)) staleVisionModels.push(model)
    }
    const registeredBeforeValidation = this.getConfiguredProviderModel()
    const staleRegistered = staleVisionModels.find((model) => model.id === registeredBeforeValidation.id)
    if (staleRegistered) {
      await this.registerModel(staleRegistered.id).catch((error) => this.note('Could not downgrade stale Vision provider registration', error))
    }
    const registered = this.getConfiguredProviderModel()
    return {
      settings: { ...this.settings, apiKey: this.settings.apiKey ? '••••••••' : '' },
      models: this.models.map((model) => ({
        ...withCapabilitySupport(model),
        contextMemory: model.ggufContextMetadata ? {
          bytesPerToken: model.ggufContextMetadata.bytesPerToken,
          architecture: model.ggufContextMetadata.architecture,
          cacheType: model.ggufContextMetadata.cacheType || 'f16',
          stateSpaceMetadata: Boolean(model.ggufContextMetadata.stateSpaceMetadata),
          estimatedBytes: estimateKvCacheBytes(model.ggufContextMetadata, model.options && model.options.contextSize),
        } : null,
        ggufContextMetadata: undefined,
        path: undefined,
        mmprojPath: model.mmprojPath || '',
        mmprojFileName: model.mmprojPath ? path.basename(model.mmprojPath) : '',
        hasMmproj: Boolean(model.mmprojPath),
        shardPaths: undefined,
        shardCount: Array.isArray(model.shardPaths) ? model.shardPaths.length : 1,
        // The verification fingerprint contains local file and executable paths. Keep it Host-side.
        visionVerification: undefined,
        visionRuntimeHint: model.visionRuntimeHint || null,
      })),
      registeredModelId: registered.id,
      registeredModelName: registered.name,
      status: this.status,
      activeModelId: this.activeModelId,
      lastError: this.lastError,
      logTail: this.logTail.slice(-6000),
      startedAt: this.startedAt,
      download: this.download ? { status: this.download.status, repoId: this.download.repoId, filename: this.download.filename, currentFile: this.download.currentFile, fileIndex: this.download.fileIndex, fileCount: this.download.fileCount, downloadedBytes: this.download.downloadedBytes, totalBytes: this.download.totalBytes, progress: this.download.progress, error: this.download.error } : null,
      lastHealth: this.lastHealth,
    }
  }

  async saveSettings(settings) {
    const src = settings && typeof settings === 'object' ? settings : {}
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
        if (!record || typeof record.path !== 'string' || !/\.gguf$/i.test(record.path) || /mmproj/i.test(path.basename(record.path))) continue
        try {
          const stat = await fsp.stat(record.path)
          if (!stat.isFile()) continue
          const fresh = describeModelFile(record.path, stat.size, record.name)
          const cachedMetadata = record.ggufContextMetadata
          const metadataMatches = cachedMetadata && cachedMetadata.fileSizeBytes === stat.size && cachedMetadata.fileMtimeMs === stat.mtimeMs
          const ggufContextMetadata = metadataMatches ? cachedMetadata : await readGgufContextMetadata(record.path)
          let mmprojPath = ''
          if (typeof record.mmprojPath === 'string' && record.mmprojPath) {
            try {
              const projectorStat = await fsp.stat(record.mmprojPath)
              if (projectorStat.isFile() && /mmproj/i.test(path.basename(record.mmprojPath))) mmprojPath = record.mmprojPath
            } catch { /* a missing projector disables Vision until it is attached again */ }
          }
          restored.push({
            ...fresh,
            ggufContextMetadata,
            id: typeof record.id === 'string' ? record.id : fresh.id,
            addedAt: record.addedAt || fresh.addedAt,
            options: normalizeModelOptions(record.options),
            hubMetadata: record.hubMetadata && typeof record.hubMetadata === 'object' ? record.hubMetadata : null,
            capabilities: Array.isArray(record.capabilities) ? record.capabilities : fresh.capabilities,
            capabilitySource: record.capabilitySource || (record.hubMetadata ? 'huggingface' : fresh.capabilitySource),
            llamaCppListed: Boolean(record.llamaCppListed || (record.hubMetadata && record.hubMetadata.llamaCppListed)),
            runtimeLoadVerifiedAt: record.runtimeLoadVerifiedAt || null,
            mmprojPath,
            visionVerifiedAt: mmprojPath ? (record.visionVerifiedAt || null) : null,
            visionVerificationSource: mmprojPath ? (record.visionVerificationSource || null) : null,
            visionVerification: mmprojPath && record.visionVerification && typeof record.visionVerification === 'object' ? record.visionVerification : null,
            shardPaths: Array.isArray(record.shardPaths) ? record.shardPaths.filter((item) => typeof item === 'string') : undefined,
          })
        } catch { /* ignore catalog items whose model file was moved or deleted */ }
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
      const fileStat = await fsp.stat(fullPath)
      const cachedMetadata = existing && existing.ggufContextMetadata
      const metadataMatches = cachedMetadata && cachedMetadata.fileSizeBytes === fileStat.size && cachedMetadata.fileMtimeMs === fileStat.mtimeMs
      const ggufContextMetadata = metadataMatches ? cachedMetadata : await readGgufContextMetadata(fullPath)
      let mmprojPath = file.mmprojPath || ''
      if (existing && existing.mmprojPath) {
        try {
          const stat = await fsp.stat(existing.mmprojPath)
          if (stat.isFile() && /mmproj/i.test(path.basename(existing.mmprojPath))) mmprojPath = existing.mmprojPath
        } catch { /* fall back to the unambiguous projector discovered beside the model */ }
      }
      const sameProjector = existing && existing.mmprojPath && path.resolve(existing.mmprojPath) === path.resolve(mmprojPath)
      discovered.push({
        ...model,
        ggufContextMetadata,
        options: existing ? existing.options : { ...DEFAULT_MODEL_OPTIONS },
        addedAt: existing ? existing.addedAt : model.addedAt,
        hubMetadata: existing ? existing.hubMetadata : null,
        capabilities: existing && Array.isArray(existing.capabilities) ? existing.capabilities : model.capabilities,
        capabilitySource: existing ? existing.capabilitySource : model.capabilitySource,
        llamaCppListed: Boolean(existing && existing.llamaCppListed),
        runtimeLoadVerifiedAt: existing ? existing.runtimeLoadVerifiedAt : null,
        mmprojPath,
        visionVerifiedAt: sameProjector ? (existing.visionVerifiedAt || null) : null,
        visionVerificationSource: sameProjector ? (existing.visionVerificationSource || null) : null,
        visionVerification: sameProjector ? (existing.visionVerification || null) : null,
        shardPaths: file.shardPaths,
      })
    }
    const unreadableDirectories = scan.skippedDirectoryPaths || []
    const preservedFromUnreadableDirectories = this.models.filter((model) =>
      !this.hiddenModelIds.has(model.id) && unreadableDirectories.some((directory) => ensureInside(directory, model.path))
    )
    const custom = this.models.filter((model) => !ensureInside(this.settings.modelsDir, model.path) && !this.hiddenModelIds.has(model.id))
    const merged = new Map([...discovered, ...preservedFromUnreadableDirectories, ...custom].map((model) => [model.id, model]))
    this.models = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
    await this.persistModelCatalog()
    return this.models
  }

  async scanDirectory(dir) {
    return scanGgufDirectory(cleanString(dir))
  }

  async addModel(filePath, displayName, mmprojPath) {
    const resolved = path.resolve(cleanString(filePath))
    if (!/\.gguf$/i.test(resolved) || /mmproj/i.test(path.basename(resolved))) {
      throw new Error('Выбери файл модели .gguf, а не mmproj-проектор.')
    }
    const stat = await fsp.stat(resolved)
    if (!stat.isFile()) throw new Error('Путь должен вести к файлу GGUF.')
    let projector = cleanString(mmprojPath)
    if (projector) {
      projector = path.resolve(projector)
    } else {
      // Auto-pair only when exactly one mmproj is present beside the model.
      try {
        const siblings = await fsp.readdir(path.dirname(resolved), { withFileTypes: true })
        const candidates = siblings.filter((entry) => entry.isFile() && /mmproj.*\.gguf$/i.test(entry.name))
        if (candidates.length === 1) projector = path.join(path.dirname(resolved), candidates[0].name)
      } catch { /* the explicit model file remains usable without a projector */ }
    }
    if (projector) {
      if (!/\.gguf$/i.test(projector) || !/mmproj/i.test(path.basename(projector))) throw new Error('Дополнительный файл должен быть GGUF-проектором mmproj.')
      const projectorStat = await fsp.stat(projector)
      if (!projectorStat.isFile()) throw new Error('Путь к mmproj должен вести к файлу.')
    }
    const entry = describeModelFile(resolved, stat.size, cleanString(displayName))
    const ggufContextMetadata = await readGgufContextMetadata(resolved)
    const existing = this.models.find((model) => model.id === entry.id)
    const sameProjector = existing && existing.mmprojPath && path.resolve(existing.mmprojPath) === path.resolve(projector || '')
    const model = {
      ...entry,
      ggufContextMetadata,
      options: existing ? existing.options : { ...DEFAULT_MODEL_OPTIONS },
      mmprojPath: projector,
      visionVerifiedAt: sameProjector ? (existing.visionVerifiedAt || null) : null,
      visionVerificationSource: sameProjector ? (existing.visionVerificationSource || null) : null,
      visionVerification: sameProjector ? (existing.visionVerification || null) : null,
      shardPaths: existing && Array.isArray(existing.shardPaths) ? existing.shardPaths : [resolved],
    }
    this.hiddenModelIds.delete(model.id)
    this.models = [...this.models.filter((item) => item.id !== model.id), model].sort((a, b) => a.name.localeCompare(b.name))
    await this.persistModelCatalog()
    this.note(`Model added: ${model.name}${projector ? ` + ${path.basename(projector)}` : ''}`)
    return { ...model, path: undefined, mmprojPath: undefined, mmprojFileName: projector ? path.basename(projector) : '' }
  }

  async saveModelMmproj(id, mmprojPath) {
    const model = this.models.find((item) => item.id === id)
    if (!model) throw new Error('Модель не найдена в библиотеке.')
    if (this.status !== 'stopped' && this.activeModelId === id) throw new Error('Останови модель перед сменой mmproj.')
    const nextPath = cleanString(mmprojPath) ? path.resolve(cleanString(mmprojPath)) : ''
    if (nextPath) {
      if (!/\.gguf$/i.test(nextPath) || !/mmproj/i.test(path.basename(nextPath))) throw new Error('Выбери файл mmproj с расширением .gguf.')
      const stat = await fsp.stat(nextPath)
      if (!stat.isFile()) throw new Error('Путь mmproj не является файлом.')
    }
    const changed = path.resolve(model.mmprojPath || '') !== path.resolve(nextPath || '')
    if (changed) {
      model.mmprojPath = nextPath
      model.visionVerifiedAt = null
      model.visionVerificationSource = null
      model.visionVerification = null
      model.visionRuntimeHint = null
    }
    await this.persistModelCatalog()
    if (changed && this.getPublishedModelId() === id) {
      await this.registerModel(id)
    }
    return { ok: true, mmprojFileName: nextPath ? path.basename(nextPath) : '', reRegistered: changed && this.getPublishedModelId() === id }
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
    return this.getConfiguredProviderModel().id
  }

  buildArgs(model, executable) {
    return buildServerArgs({
      executable,
      modelPath: model.path,
      mmprojPath: model.mmprojPath || '',
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
    if (model.visionVerifiedAt && await this.invalidateStaleVisionVerification(model)) {
      if (this.getPublishedModelId() === id) await this.registerModel(id)
    }
    if (model.mmprojPath) {
      try {
        const projectorStat = await fsp.stat(model.mmprojPath)
        if (!projectorStat.isFile()) throw new Error('Путь не является файлом')
      } catch (error) {
        throw new Error(`Файл mmproj не найден или недоступен: ${model.mmprojPath}. Исправь путь в карточке модели. ${safeError(error)}`)
      }
    }
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
      this.activeExecutable = executable
      if (generation !== this.startGeneration || this.status !== 'starting') {
        this.activeExecutable = null
        return { ok: true, status: 'stopped' }
      }
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
        this.activeExecutable = null
        this.status = 'stopped'
        this.activeModelId = null
        this.startedAt = null
        this.note(`llama-server exited${outcome && outcome.exitCode != null ? ` (code ${outcome.exitCode})` : ''}`)
      }, (error) => {
        if (this.process !== handle) return
        this.logTail = tailFromHandle(handle) || this.logTail
        this.process = null
        this.activeExecutable = null
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
      this.activeExecutable = null
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
          const loadedModel = this.models.find((item) => item.id === this.activeModelId)
          if (loadedModel) {
            loadedModel.runtimeLoadVerifiedAt = this.lastHealth
            await this.persistModelCatalog().catch((error) => this.note('Could not save runtime verification metadata', error))
          }
          this.note('llama-server is ready')
          if (loadedModel && loadedModel.mmprojPath) {
            await this.inspectRuntimeModalities(loadedModel).catch((error) => this.note('Could not inspect model modalities', error))
          }
          if (loadedModel) {
            await this.inspectRuntimeReasoning(loadedModel).catch((error) => this.note('Could not inspect reasoning support', error))
            const publishedId = this.getPublishedModelId()
            // If this is already the published model (or no local model was yet
            // registered), refresh DSH with the runtime-verified effort list.
            if (!publishedId || publishedId === loadedModel.id) {
              await this.registerModel(loadedModel.id).catch((error) => this.note('Could not refresh DSH model capabilities', error))
            }
          }
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

  async collectVisionFingerprint(model, executablePath) {
    const [modelStat, projectorStat, engineStat] = await Promise.all([
      fsp.stat(model.path),
      fsp.stat(model.mmprojPath),
      fsp.stat(executablePath),
    ])
    if (!modelStat.isFile() || !projectorStat.isFile() || !engineStat.isFile()) {
      throw new Error('Основной GGUF, mmproj и llama-server должны быть обычными файлами.')
    }
    return {
      modelPath: path.resolve(model.path),
      modelSize: modelStat.size,
      modelMtimeMs: modelStat.mtimeMs,
      mmprojPath: path.resolve(model.mmprojPath),
      mmprojSize: projectorStat.size,
      mmprojMtimeMs: projectorStat.mtimeMs,
      enginePath: path.resolve(executablePath),
      engineSize: engineStat.size,
      engineMtimeMs: engineStat.mtimeMs,
    }
  }

  async hasCurrentVisionVerification(model) {
    if (!model || !model.mmprojPath || !model.visionVerifiedAt || !model.visionVerification) return false
    try {
      const executable = this.activeExecutable || await this.resolveExecutable()
      const current = await this.collectVisionFingerprint(model, executable)
      return JSON.stringify(current) === JSON.stringify(model.visionVerification)
    } catch { return false }
  }

  async invalidateStaleVisionVerification(model) {
    if (!model || !model.visionVerifiedAt || await this.hasCurrentVisionVerification(model)) return false
    model.visionVerifiedAt = null
    model.visionVerificationSource = null
    model.visionVerification = null
    model.visionRuntimeHint = { status: 'verification-stale', modalities: [], checkedAt: new Date().toISOString() }
    await this.persistModelCatalog().catch((error) => this.note('Could not clear stale Vision verification', error))
    return true
  }

  async inspectRuntimeModalities(model) {
    const headers = this.settings.apiKey ? { Authorization: `Bearer ${this.settings.apiKey}` } : {}
    const response = await fetch(`http://127.0.0.1:${this.settings.port}/v1/models`, { headers, signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error(`/v1/models вернул HTTP ${response.status}`)
    const payload = await response.json()
    const active = Array.isArray(payload.data)
      ? payload.data.find((item) => item && (item.id === model.id || item.id === model.name)) || payload.data[0]
      : null
    if (!active) return { image: null, source: 'metadata unavailable' }
    const architecture = active.architecture || active.meta && active.meta.architecture || {}
    const modalities = architecture.input_modalities || active.input_modalities || active.modalities || active.meta && active.meta.modalities || []
    const normalized = Array.isArray(modalities) ? modalities.map((item) => String(item).toLowerCase()) : []
    model.visionRuntimeHint = normalized.includes('image')
      ? { status: 'image-advertised', modalities: normalized, checkedAt: new Date().toISOString() }
      : normalized.length
        ? { status: 'image-not-advertised', modalities: normalized, checkedAt: new Date().toISOString() }
        : { status: 'unknown', modalities: [], checkedAt: new Date().toISOString() }
    await this.persistModelCatalog()
    return { image: normalized.includes('image'), modalities: normalized }
  }

  async inspectRuntimeReasoning(model) {
    const headers = this.settings.apiKey ? { Authorization: `Bearer ${this.settings.apiKey}` } : {}
    try {
      const response = await fetch(`http://127.0.0.1:${this.settings.port}/props`, {
        headers,
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error(`llama-server /props вернул HTTP ${response.status}`)
      const props = await response.json()
      const result = readLlamaReasoningCapabilities(props)
      model.reasoningEfforts = result.reasoningEfforts
      model.reasoningRuntimeHint = {
        status: result.status,
        levels: result.levels,
        detail: result.detail,
        checkedAt: new Date().toISOString(),
        source: '/props chat_template_caps',
      }
      await this.persistModelCatalog()
      if (result.status === 'supported') {
        this.note(`Reasoning effort levels detected for ${model.name}: ${result.levels.join(', ')}`)
      } else {
        this.note(`No selectable reasoning levels reported for ${model.name}: ${result.status}`)
      }
      return result
    } catch (error) {
      // A failed /props inspection must never leave old capabilities advertised.
      model.reasoningEfforts = null
      model.reasoningRuntimeHint = {
        status: 'unknown',
        levels: [],
        detail: `Не удалось проверить шаблон модели через /props: ${safeError(error)}`,
        checkedAt: new Date().toISOString(),
        source: '/props unavailable',
      }
      await this.persistModelCatalog().catch((persistError) => this.note('Could not clear stale reasoning metadata', persistError))
      throw error
    }
  }

  async testVision() {
    if (this.status !== 'ready' || !this.process || !this.activeModelId) throw new Error('Сначала запусти модель с привязанным mmproj и дождись статуса «Сервер запущен».')
    const model = this.models.find((item) => item.id === this.activeModelId)
    if (!model || !model.mmprojPath) throw new Error('Для активной модели не привязан mmproj-файл.')
    try {
      const projectorStat = await fsp.stat(model.mmprojPath)
      if (!projectorStat.isFile()) throw new Error('mmproj не является файлом.')
    } catch (error) {
      throw new Error(`Файл mmproj недоступен: ${safeError(error)}`)
    }

    // A tiny synthetic PNG exercises the real image-input path without uploading user data.
    const image = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAR0lEQVR42mN8pqHBgA3YBqzCKn54QxhJ6pkYaAxGLRi1gHLAqFxxiSrpHZf60TgYtWAo5IPR+mDUglELRuuDUQtGLWBgYAAA9rcXg3x510QAAAAASUVORK5CYII='
    const headers = { 'Content-Type': 'application/json' }
    if (this.settings.apiKey) headers.Authorization = `Bearer ${this.settings.apiKey}`
    const response = await fetch(`http://127.0.0.1:${this.settings.port}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'This is a compatibility test. Reply with OK.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
        ] }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      }),
    })
    const responseText = await response.text()
    if (!response.ok) throw new Error(`llama-server не принял изображение (HTTP ${response.status}): ${responseText.slice(0, 1200)}`)
    let result
    try { result = JSON.parse(responseText) } catch { throw new Error('llama-server вернул невалидный JSON на запрос с изображением.') }
    if (!Array.isArray(result.choices) || !result.choices.length) throw new Error('llama-server принял HTTP-запрос, но не вернул completion. Vision не будет включён.')

    model.visionVerifiedAt = new Date().toISOString()
    model.visionVerification = await this.collectVisionFingerprint(model, this.activeExecutable || await this.resolveExecutable())
    model.visionVerificationSource = 'image-input probe accepted by llama-server; semantic quality not evaluated'
    model.visionRuntimeHint = { status: 'image-tested', modalities: ['text', 'image'], checkedAt: model.visionVerifiedAt }
    await this.persistModelCatalog()
    await this.registerModel(model.id)
    this.note(`Vision image-input probe passed for ${model.name}; DSH model registration updated`)
    return { ok: true, modelId: model.id, verifiedAt: model.visionVerifiedAt, registered: true, note: 'Сервер принял тестовое изображение. Качество распознавания не оценивалось.' }
  }

  async stop() {
    const handle = this.process
    if (!handle) {
      if (this.status === 'starting') {
        this.startGeneration += 1
        this.status = 'stopped'
        this.activeExecutable = null
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
      this.activeExecutable = null
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
    const previousHeaders = { ...(prior.headers || {}) }
    if (this.settings.apiKey) previousHeaders.authorization = `Bearer ${this.settings.apiKey}`
    else if (previousHeaders.authorization === 'Bearer dsh-local-ai') delete previousHeaders.authorization

    // Each registration describes exactly the one model loaded by this single-model server.
    // Existing DSH conversations keep their old model id, so the UI instructs users to start
    // a new conversation or switch the model in the current conversation after registration.
    const visionVerified = await this.hasCurrentVisionVerification(model)
    if (model.visionVerifiedAt && !visionVerified) await this.invalidateStaleVisionVerification(model)
    const ctx = model.options.contextSize
    const models = [{
      id: model.id,
      name: model.name,
      contextWindow: ctx,
      maxTokens: Math.max(256, Math.floor(ctx / 4)),
      input: visionVerified ? ['text', 'image'] : ['text'],
      ...(model.reasoningRuntimeHint && model.reasoningRuntimeHint.status === 'supported' && model.reasoningEfforts
        ? { reasoningEfforts: { ...model.reasoningEfforts } }
        : {}),
    }]
    const { reasoning: _oldReasoning, ...priorWithoutReasoning } = prior
    providers[PROVIDER_KEY] = {
      ...priorWithoutReasoning,
      displayName: 'Local AI (llama.cpp)',
      api: 'openai-completions',
      baseURL: `http://127.0.0.1:${this.settings.port}/v1`,
      headers: previousHeaders,
      defaultInput: ['text'],
      models,
    }
    await this.ctx.settings.mutate(this.settings.settingsNamespace, [
      { op: 'set', path: ['providers'], value: providers },
    ], desc.revision)

    // Read the committed settings back. A successful write is not enough if the active
    // profile/namespace is not the one consumed by llm-pi-ai.
    const updated = this.ctx.settings.describe().find((item) => item.ns === this.settings.settingsNamespace)
    const updatedProvider = updated && updated.value && updated.value.providers && updated.value.providers[PROVIDER_KEY]
    const registered = updatedProvider && Array.isArray(updatedProvider.models)
      ? updatedProvider.models.some((entry) => entry && entry.id === model.id)
      : false
    if (!registered) {
      throw new Error(`DSH не подтвердил регистрацию модели ${model.id} в ${this.settings.settingsNamespace}. Проверь профиль DSH и повтори «В DSH».`)
    }
    this.note(`Registered ${model.name} (${model.id}) in DSH model list`)
    return { ok: true, provider: PROVIDER_KEY, modelId: model.id, modelName: model.name, requiresNewSession: true }
  }

  async fetchHubTreeInventory(repoId, revision) {
    const files = []
    const visited = new Set()
    let url = buildHubTreeUrl(repoId, revision)
    const maxPages = 100
    for (let page = 0; page < maxPages && url; page += 1) {
      if (visited.has(url)) throw new Error('Hugging Face повторил ссылку страницы дерева репозитория.')
      visited.add(url)
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(18000),
      })
      if (!response.ok) throw new Error(`Hugging Face tree API вернул HTTP ${response.status}.`)
      const batch = await response.json()
      if (!Array.isArray(batch)) throw new Error('Hugging Face вернул некорректный список файлов репозитория.')
      files.push(...batch)
      const nextUrl = getNextHubTreePageUrl(response.headers.get('link'), url, repoId, revision)
      if (!nextUrl) return sanitizeHubTreeInventory(files, repoId)
      url = nextUrl
    }
    if (url) throw new Error(`Дерево Hugging Face превышает лимит ${maxPages} страниц; полный список не будет использован.`)
    return sanitizeHubTreeInventory(files, repoId)
  }

  async searchHub(query, sort, paramsRange, weightRange) {
    const queries = buildHubSearchQueries(query)
    let firstError = null
    for (const searchQuery of queries) {
      const requests = buildHubSearchUrls(searchQuery, sort, paramsRange)
      const results = await Promise.allSettled(requests.map(async (request) => {
        const response = await fetch(request.url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(18000),
        })
        if (!response.ok) throw new Error(`Hugging Face (${request.kind}) вернул HTTP ${response.status}.`)
        const data = await response.json()
        return sanitizeHubModels(data, request.kind)
      }))
      const fulfilled = results.filter((entry) => entry.status === 'fulfilled')
      if (!fulfilled.length && !firstError) {
        const failed = results.find((entry) => entry.status === 'rejected')
        if (failed) firstError = failed.reason
      }
      const models = mergeHubSearchResults(fulfilled.map((entry) => entry.value), MAX_HUB_SEARCH_RESULTS)
      if (models.length) {
        // The list endpoint often returns filenames without byte sizes. Resolve exact GGUF sizes
        // from each repository's tree API so the weight filter and selected-file details are real.
        let cursor = 0
        const enriched = new Array(models.length)
        const workers = Array.from({ length: Math.min(4, models.length) }, async () => {
          while (cursor < models.length) {
            const index = cursor++
            const model = models[index]
            const cacheKey = `${model.id}@${model.revision || 'main'}`
            const cached = this.hubFileMetadataCache.get(cacheKey)
            if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
              const files = cached.files.map((file) => {
                const fallback = (model.files || []).find((entry) => entry.name === file.name)
                return { ...fallback, ...file }
              })
              const projectorMap = new Map((model.projectors || []).map((file) => [file.name, file]))
              for (const file of cached.projectors || []) projectorMap.set(file.name, { ...projectorMap.get(file.name), ...file })
              enriched[index] = { ...model, files, projectors: [...projectorMap.values()], incompleteShards: cached.incompleteShards || model.incompleteShards || [], fileCount: files.length }
              continue
            }
            try {
              const inventory = await this.fetchHubTreeInventory(model.id, model.revision || 'main')
              const treeFiles = inventory.files
              const files = treeFiles.length
                ? treeFiles.map((file) => {
                    const fallback = (model.files || []).find((entry) => entry.name === file.name)
                    return { ...fallback, ...file }
                  })
                : model.files
              const projectorMap = new Map((model.projectors || []).map((file) => [file.name, file]))
              for (const file of inventory.projectors) projectorMap.set(file.name, { ...projectorMap.get(file.name), ...file })
              const projectors = [...projectorMap.values()]
              this.hubFileMetadataCache.set(cacheKey, { fetchedAt: Date.now(), files, projectors, incompleteShards: inventory.incompleteShards })
              if (this.hubFileMetadataCache.size > 100) this.hubFileMetadataCache.delete(this.hubFileMetadataCache.keys().next().value)
              enriched[index] = { ...model, files, projectors, incompleteShards: inventory.incompleteShards, fileCount: files.length }
            } catch (error) {
              this.note(`Hugging Face file metadata unavailable for ${model.id}: ${safeError(error)}`)
              enriched[index] = model
            }
          }
        })
        await Promise.all(workers)
        const filteredModels = filterHubModelsByWeight(enriched, weightRange)
        if (filteredModels.length) {
          this.note(`Hugging Face search: ${filteredModels.length} GGUF repositories found after filters`)
          return filteredModels.map((model) => withCapabilitySupport(model))
        }
        if (weightRange === 'any') return enriched.map((model) => withCapabilitySupport(model))
      }
    }
    if (firstError) throw new Error(safeError(firstError))
    this.note('Hugging Face search: no standalone GGUF files found')
    return []
  }

  async downloadHubModel(repoId, filename, repoMetadata) {
    if (this.download && this.download.status === 'downloading') throw new Error('Загрузка уже выполняется. Дождись её завершения или отмени.')
    const safeRepo = safeHubRepoId(repoId)
    const metadataInput = repoMetadata && typeof repoMetadata === 'object' ? repoMetadata : {}
    const plan = buildHubDownloadPlan(filename, metadataInput)
    const safeFile = plan.mainFile
    const revision = plan.revision
    const projectorName = plan.mmprojFile
    const bundleFiles = plan.files

    await fsp.mkdir(this.settings.modelsDir, { recursive: true })
    const baseSlug = `${safeRepo.replace('/', '__')}-${path.basename(safeFile).replace(/\.gguf$/i, '')}`
      .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+|\.+$/g, '').slice(0, 90)
    const unique = createHash('sha256').update(`${safeRepo}/${safeFile}@${revision}`).digest('hex').slice(0, 10)
    const folderName = `${baseSlug || 'hf-model'}-${unique}`
    const destinationFolder = path.resolve(this.settings.modelsDir, folderName)
    if (!ensureInside(this.settings.modelsDir, destinationFolder)) throw new Error('Небезопасная папка сохранения модели.')
    try { await fsp.access(destinationFolder); throw new Error(`Комплект уже существует: ${destinationFolder}. Обнови библиотеку или удали старую копию вручную.`) } catch (error) { if (error && error.code !== 'ENOENT') throw error }

    const tempFolder = path.resolve(this.settings.modelsDir, `.download-${unique}-${Date.now()}`)
    if (!ensureInside(this.settings.modelsDir, tempFolder)) throw new Error('Небезопасная временная папка загрузки.')
    const controller = new AbortController()
    this.downloadController = controller
    const expectedTotal = plan.expectedBytes
    this.download = {
      status: 'downloading', repoId: safeRepo, filename: safeFile, currentFile: '',
      fileIndex: 0, fileCount: bundleFiles.length, downloadedBytes: 0,
      totalBytes: expectedTotal, progress: 0, error: null,
    }
    let committed = false
    try {
      await fsp.mkdir(tempFolder, { recursive: false })
      const localPaths = new Map()
      const localTargets = new Set()
      for (let index = 0; index < bundleFiles.length; index += 1) {
        if (controller.signal.aborted) throw new Error('Загрузка отменена.')
        const file = bundleFiles[index]
        const safeName = safeHubFilename(file.name)
        const safeSegments = safeName.split('/').map((segment) => {
          let safe = segment.replace(/[<>:"|?*\x00-\x1F]/g, '_').replace(/[ .]+$/g, '_')
          if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`
          return safe || '_'
        })
        const relativePath = safeSegments.join(path.sep)
        const target = path.resolve(tempFolder, relativePath)
        if (!ensureInside(tempFolder, target)) throw new Error(`Небезопасный путь файла: ${file.name}`)
        const targetKey = process.platform === 'win32' ? target.toLowerCase() : target
        if (localTargets.has(targetKey)) throw new Error(`Имена файлов конфликтуют после преобразования для Windows: ${file.name}`)
        localTargets.add(targetKey)
        await fsp.mkdir(path.dirname(target), { recursive: true })
        const partial = `${target}.part`
        this.download.currentFile = file.name
        this.download.fileIndex = index + 1
        const response = await fetch(buildHubDownloadUrl(safeRepo, safeName, revision), {
          redirect: 'follow', signal: controller.signal,
          headers: { Accept: 'application/octet-stream' },
        })
        if (!response.ok || !response.body) {
          const reason = await response.text().catch(() => '')
          throw new Error(`Hugging Face не смог скачать ${file.name}: HTTP ${response.status}. ${reason.slice(0, 500)}`)
        }
        const contentLength = Number(response.headers.get('content-length')) || 0
        if (!file.sizeBytes && contentLength) this.download.totalBytes += contentLength
        const counter = new Transform({
          transform: (chunk, encoding, callback) => {
            this.download.downloadedBytes += chunk.length
            this.download.progress = this.download.totalBytes
              ? Math.min(99, Math.floor(this.download.downloadedBytes / this.download.totalBytes * 100))
              : 0
            callback(null, chunk)
          },
        })
        await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(partial, { flags: 'wx' }), { signal: controller.signal })
        const stat = await fsp.stat(partial)
        if (!stat.isFile() || stat.size <= 0) throw new Error(`Загруженный файл пустой: ${file.name}`)
        if (file.sizeBytes > 0 && stat.size !== file.sizeBytes) {
          throw new Error(`Размер ${file.name} не совпал: ожидалось ${file.sizeBytes} байт, получено ${stat.size}. Комплект не будет добавлен.`)
        }
        await fsp.rename(partial, target)
        localPaths.set(file.name, target)
        this.note(`Downloaded component ${index + 1}/${bundleFiles.length}: ${file.name} (${stat.size} bytes)`)
      }
      if (controller.signal.aborted) throw new Error('Загрузка отменена.')
      await fsp.rename(tempFolder, destinationFolder)
      committed = true
      const finalPaths = new Map([...localPaths.entries()].map(([name, localPath]) => [name, path.join(destinationFolder, path.relative(tempFolder, localPath))]))
      const mainFile = bundleFiles.find((file) => file.role === 'main')
      const mainPath = finalPaths.get(mainFile.name)
      const mmprojPath = projectorName ? finalPaths.get(projectorName) : ''
      const displayName = plan.displayName || path.basename(safeFile).replace(/-00001-of-\d{5}(?=\.gguf$)/i, '').replace(/\.gguf$/i, '')
      const added = await this.addModel(mainPath, displayName, mmprojPath || '')
      const localModel = this.models.find((item) => item.id === added.id)
      if (localModel) {
        localModel.shardPaths = bundleFiles.filter((file) => file.role === 'main' || file.role === 'shard').map((file) => finalPaths.get(file.name)).filter(Boolean)
        const metadata = sanitizeHubRepositoryMetadata({ ...metadataInput, revision, mmprojFilename: projectorName }, safeRepo)
        localModel.hubMetadata = metadata
        localModel.capabilities = metadata.capabilities
        localModel.capabilitySource = 'huggingface'
        localModel.llamaCppListed = metadata.llamaCppListed
        await this.persistModelCatalog()
      }
      const totalBytes = this.download.totalBytes || this.download.downloadedBytes
      this.download = {
        ...this.download, status: 'complete', progress: 100,
        destinationFolder, destination: mainPath,
        downloadedBytes: this.download.downloadedBytes,
        totalBytes,
      }
      this.note(`Downloaded GGUF bundle ${safeRepo}/${safeFile}@${revision}; ${bundleFiles.length} files saved`)
      return { ok: true, model: localModel ? { ...localModel, path: undefined, mmprojPath: undefined, shardPaths: undefined } : added, files: bundleFiles.length, mmproj: Boolean(mmprojPath) }
    } catch (error) {
      await fsp.rm(tempFolder, { recursive: true, force: true }).catch(() => {})
      if (committed) {
        await fsp.rm(destinationFolder, { recursive: true, force: true }).catch(() => {})
        const destinationPrefix = path.resolve(destinationFolder) + path.sep
        this.models = this.models.filter((model) => {
          const modelPath = path.resolve(model.path)
          return modelPath !== path.resolve(destinationFolder) && !modelPath.startsWith(destinationPrefix)
        })
        await this.persistModelCatalog().catch((persistError) => this.note('Could not roll back failed model bundle from the catalog', persistError))
      }
      const cancelled = controller.signal.aborted
      this.download = { ...(this.download || {}), status: cancelled ? 'cancelled' : 'error', error: cancelled ? null : safeError(error) }
      if (!cancelled) this.note('Hugging Face bundle download failed', error)
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
  'getState', 'refreshModels', 'saveSettings', 'scanDirectory', 'addModel', 'saveModelMmproj', 'removeModel',
  'saveModelOptions', 'start', 'stop', 'testEngine', 'testVision', 'registerModel',
  'searchHub', 'downloadHubModel', 'cancelDownload',
])

export default LocalAIWorkbenchService
