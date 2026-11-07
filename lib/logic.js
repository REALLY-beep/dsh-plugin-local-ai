/** Pure helpers shared by the Host runtime and offline tests. */
export const DEFAULT_SETTINGS = Object.freeze({
  serverPath: '',
  serverName: process.platform === 'win32' ? 'llama-server.exe' : 'llama-server',
  modelsDir: '',
  port: 12345,
  apiKey: '',
  settingsNamespace: 'llm-pi-ai',
  autoRegister: false,
})

export const DEFAULT_MODEL_OPTIONS = Object.freeze({
  contextSize: 8192,
  gpuLayers: 99,
  threads: Math.max(1, Math.min(16, (typeof process !== 'undefined' && process.availableParallelism ? process.availableParallelism() : 8) - 1)),
  batchSize: 512,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  flashAttention: true,
  jinja: true,
})

export function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

export function normalizeSettings(input = {}, defaults = DEFAULT_SETTINGS) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const port = Number(src.port)
  return {
    serverPath: cleanString(src.serverPath, defaults.serverPath),
    serverName: cleanString(src.serverName, defaults.serverName) || defaults.serverName,
    modelsDir: cleanString(src.modelsDir, defaults.modelsDir),
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : defaults.port,
    apiKey: cleanString(src.apiKey, defaults.apiKey),
    settingsNamespace: cleanString(src.settingsNamespace, defaults.settingsNamespace) || defaults.settingsNamespace,
    autoRegister: Boolean(src.autoRegister),
  }
}

export function normalizeModelOptions(input = {}) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const number = (key, min, max, fallback, integer = false) => {
    const n = Number(src[key])
    if (!Number.isFinite(n) || n < min || n > max) return fallback
    return integer ? Math.round(n) : n
  }
  return {
    contextSize: number('contextSize', 512, 1048576, DEFAULT_MODEL_OPTIONS.contextSize, true),
    gpuLayers: number('gpuLayers', 0, 999, DEFAULT_MODEL_OPTIONS.gpuLayers, true),
    threads: number('threads', 1, 512, DEFAULT_MODEL_OPTIONS.threads, true),
    batchSize: number('batchSize', 1, 8192, DEFAULT_MODEL_OPTIONS.batchSize, true),
    temperature: number('temperature', 0, 5, DEFAULT_MODEL_OPTIONS.temperature),
    topP: number('topP', 0.01, 1, DEFAULT_MODEL_OPTIONS.topP),
    topK: number('topK', 0, 1000, DEFAULT_MODEL_OPTIONS.topK, true),
    repeatPenalty: number('repeatPenalty', 0.5, 2, DEFAULT_MODEL_OPTIONS.repeatPenalty),
    flashAttention: src.flashAttention !== false,
    jinja: src.jinja !== false,
  }
}

export function buildServerArgs({ executable, modelPath, mmprojPath = '', port, apiKey, options, alias }) {
  if (!executable || !modelPath) throw new Error('Не указан llama-server или GGUF-файл модели.')
  const o = normalizeModelOptions(options)
  const argv = [
    executable,
    '--model', modelPath,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--alias', cleanString(alias, 'local-model') || 'local-model',
    '--ctx-size', String(o.contextSize),
    '--n-gpu-layers', String(o.gpuLayers),
    '--threads', String(o.threads),
    '--batch-size', String(o.batchSize),
    '--temp', String(o.temperature),
    '--top-p', String(o.topP),
    '--top-k', String(o.topK),
    '--repeat-penalty', String(o.repeatPenalty),
  ]
  if (mmprojPath) argv.push('--mmproj', mmprojPath)
  if (o.flashAttention) argv.push('--flash-attn', 'on')
  if (o.jinja) argv.push('--jinja')
  if (apiKey) argv.push('--api-key', apiKey)
  return argv
}

export function modelIdFromPath(filePath) {
  // Stable id across launches; path itself stays host-side and is never sent to the model provider.
  let hash = 2166136261
  for (const char of String(filePath).toLowerCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return 'gguf-' + (hash >>> 0).toString(16).padStart(8, '0')
}

export function describeModelFile(filePath, sizeBytes, name) {
  const base = cleanString(name) || String(filePath).split(/[\\/]/).pop().replace(/\.gguf$/i, '')
  const size = Number.isFinite(sizeBytes) ? sizeBytes : 0
  const quantMatch = base.match(/(?:^|[-_.])(Q[0-9](?:_[A-Z0-9]+)*|IQ[0-9A-Z_]+|F16|F32|BF16)(?:$|[-_.])/i)
  return {
    id: modelIdFromPath(filePath),
    name: base,
    fileName: String(filePath).split(/[\\/]/).pop(),
    path: filePath,
    sizeBytes: size,
    sizeLabel: formatBytes(size),
    quantization: quantMatch ? quantMatch[1].toUpperCase() : 'Unknown',
    capabilities: inferModelCapabilities(base),
    capabilitySource: 'filename',
    hubMetadata: null,
    mmprojPath: null,
    visionVerifiedAt: null,
    visionVerificationSource: null,
    llamaCppListed: false,
    runtimeLoadVerifiedAt: null,
    options: { ...DEFAULT_MODEL_OPTIONS },
    addedAt: new Date().toISOString(),
  }
}


/** Estimate transformer KV-cache use with the default F16 K/V cache.
 * This is not total process RAM/VRAM: weights, compute buffers, mmproj, allocator
 * overhead, and hybrid state-space memory are not included.
 */
export function estimateKvCacheBytes(metadata, contextTokens) {
  const bytesPerToken = Number(metadata && metadata.bytesPerToken)
  const tokens = Number(contextTokens)
  if (!Number.isFinite(bytesPerToken) || bytesPerToken <= 0 || !Number.isFinite(tokens) || tokens <= 0) return null
  return Math.ceil(bytesPerToken * Math.floor(tokens))
}

export function formatGiB(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) return '—'
  return `${(value / 1024 ** 3).toFixed(2)} GiB`
}

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1 }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[i]}`
}


const HUB_SORT_FIELDS = Object.freeze({
  trending: 'trendingScore',
  downloads: 'downloads',
  likes: 'likes',
  updated: 'lastModified',
})

/** Normalize common human-readable model queries to the Hub's substring-style model-ID search. */
export function buildHubSearchQueries(query) {
  const q = cleanString(query)
  if (!q) return ['']
  const normalized = q.replace(/\s+/g, '-')
  const family = q.split(/\s+/).find((part) => !/^(?:gguf|q[0-9][a-z0-9_]*|iq[0-9a-z_]+|f16|f32|bf16)$/i.test(part)) || q.split(/\s+/)[0]
  return [...new Set([q, normalized, family].filter(Boolean))]
}

const HUB_PARAMETER_FILTERS = Object.freeze({
  any: '',
  upTo4B: 'min:0,max:4B',
  from4To8B: 'min:4B,max:8B',
  from8To14B: 'min:8B,max:14B',
  from14To32B: 'min:14B,max:32B',
  from32To70B: 'min:32B,max:70B',
  from70B: 'min:70B',
})

const HUB_WEIGHT_RANGES = Object.freeze({
  any: null,
  upTo2GB: { min: 0, max: 2 * 1024 ** 3 },
  from2To5GB: { min: 2 * 1024 ** 3, max: 5 * 1024 ** 3 },
  from5To10GB: { min: 5 * 1024 ** 3, max: 10 * 1024 ** 3 },
  from10To20GB: { min: 10 * 1024 ** 3, max: 20 * 1024 ** 3 },
  from20GB: { min: 20 * 1024 ** 3, max: Number.POSITIVE_INFINITY },
})

/** Extract a parameter count only when the name explicitly contains a numeric B marker. */
export function extractParameterCountB(value) {
  const source = cleanString(value)
  if (!source) return null
  const match = source.match(/(?:^|[\s._-])(\d+(?:\.\d+)?)\s*B(?=$|[\s._-])/i)
  if (!match) return null
  const count = Number(match[1])
  return Number.isFinite(count) && count > 0 ? count : null
}

export function extractQuantization(value) {
  const source = cleanString(value)
  const match = source.match(/(?:^|[-_.])(Q[0-9](?:_[A-Z0-9]+)*|IQ[0-9A-Z_]+|F16|F32|BF16)(?=$|[-_.])/i)
  return match ? match[1].toUpperCase() : 'Unknown'
}

const CAPABILITY_DEFINITIONS = Object.freeze({
  chat: { id: 'chat', label: 'Текст / чат', icon: '💬' },
  code: { id: 'code', label: 'Код', icon: '⌨️' },
  vision: { id: 'vision', label: 'Vision', icon: '👁️' },
  audio: { id: 'audio', label: 'Аудио', icon: '🎧' },
  tools: { id: 'tools', label: 'Tools', icon: '🧰' },
  reasoning: { id: 'reasoning', label: 'Reasoning', icon: '🧠' },
  embeddings: { id: 'embeddings', label: 'Embeddings', icon: '🔎' },
  rerank: { id: 'rerank', label: 'Rerank', icon: '↕️' },
})

const CAPABILITY_SUPPORT = Object.freeze({
  chat: { status: 'supported', mark: '✓', detail: 'Текстовый чат поддерживается через DSH → llama-server → OpenAI Chat Completions.' },
  code: { status: 'supported', mark: '✓', detail: 'Кодовые задачи отправляются как обычный текстовый запрос. Качество зависит от обучения конкретной модели.' },
  tools: { status: 'conditional', mark: '~', detail: 'Нужны включённый Jinja, совместимый chat template GGUF и модель, обученная вызывать инструменты.' },
  reasoning: { status: 'conditional', mark: '~', detail: 'Reasoning зависит от обучающих данных, формата модели и chat template; это не отдельная гарантия движка.' },
  vision: { status: 'conditional', mark: '~', detail: 'Нужны Vision-совместимая архитектура, соответствующий mmproj, поддержка в llama.cpp и успешная runtime-проверка.' },
  audio: { status: 'unsupported', mark: '×', detail: 'Аудиовход/выход не включён в текущий DSH-провайдер плагина.' },
  embeddings: { status: 'unsupported', mark: '×', detail: 'Отдельный embeddings-маршрут не подключён в текущем DSH-провайдере.' },
  rerank: { status: 'unsupported', mark: '×', detail: 'Отдельный reranking-маршрут не подключён в текущем DSH-провайдере.' },
})

/** Describe actual plugin/runtime support separately from model-card capability hints. */
export function describeCapabilitySupport(capabilityId, model = {}) {
  const source = model && typeof model === 'object' ? model : {}
  const base = CAPABILITY_SUPPORT[capabilityId] || { status: 'unknown', mark: '?', detail: 'Совместимость функции не определена.' }
  if (capabilityId === 'tools' && source.options && source.options.jinja === false) {
    return { status: 'unsupported', mark: '×', detail: 'Tools недоступны: для этой модели отключён Jinja, необходимый для обработки tool calls в llama.cpp.' }
  }
  if (capabilityId === 'vision') {
    if (source.visionVerifiedAt && source.mmprojPath) {
      return { status: 'supported', mark: '✓', detail: `Vision прошёл проверку локального сервера${source.visionVerificationSource ? ` (${source.visionVerificationSource})` : ''}.` }
    }
    if (source.mmprojPath) {
      return { status: 'conditional', mark: '~', detail: 'mmproj привязан, но Vision ещё не прошёл проверку на запущенном llama-server. Запусти модель и нажми «Проверить Vision».' }
    }
    return { status: 'conditional', mark: '~', detail: 'Модель заявлена как Vision по метаданным, но к ней ещё не привязан подходящий mmproj. Без пары GGUF + mmproj функция не заработает.' }
  }
  return { ...base }
}

/** Attach verified runtime/plugin availability to advertised model capabilities. */
export function withCapabilitySupport(model) {
  const source = model && typeof model === 'object' ? model : {}
  const capabilities = Array.isArray(source.capabilities) ? [...source.capabilities] : []
  if (source.mmprojPath && !capabilities.some((item) => item && item.id === 'vision')) {
    capabilities.push(CAPABILITY_DEFINITIONS.vision)
  }
  return {
    ...source,
    capabilities: capabilities.map((item) => ({
      ...item,
      ...describeCapabilitySupport(item && item.id, source),
    })),
  }
}

/**
 * Infer advertised model capabilities from public Hub metadata and repository naming.
 * These are descriptive hints, not a runtime test of a specific llama.cpp build.
 */
export function inferModelCapabilities(modelId, pipelineTag = '', tags = []) {
  const id = cleanString(modelId).toLowerCase()
  const pipeline = cleanString(pipelineTag).toLowerCase()
  const normalizedTags = (Array.isArray(tags) ? tags : [])
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.toLowerCase())
  const haystack = `${id} ${pipeline} ${normalizedTags.join(' ')}`
  const has = (pattern) => pattern.test(haystack)
  const result = []
  const add = (key) => { if (!result.some((item) => item.id === key)) result.push(CAPABILITY_DEFINITIONS[key]) }

  if (/(image-text-to-text|image-to-text|visual-question-answering|document-question-answering|video-text-to-text)/.test(pipeline)
    || has(/(?:^|[\s._-])(vision|multimodal|multi-modal|llava|qwen2-vl|qwen2[._-]?5-vl|qwen3-vl|qwen-vl|gemma-?3|pixtral|internvl|idefics|florence|smolvlm|moondream|minicpm-v|granite-.*vision|phi-3[._-]?5-vision|phi-4-multimodal|mistral-small-3[._-]?1)(?:$|[\s._-])/)) add('vision')
  if (/(automatic-speech-recognition|text-to-speech|text-to-audio|audio-to-audio|audio-classification|audio-text-to-text|voice-activity-detection)/.test(pipeline)
    || has(/(?:^|[\s._-])(audio|speech|whisper|parler|vocoder|tts|asr)(?:$|[\s._-])/)) add('audio')
  if (/(feature-extraction|sentence-similarity|text-embeddings-inference)/.test(pipeline)
    || has(/(?:^|[\s._-])(embedding|embeddings|embed)(?:$|[\s._-])/)) add('embeddings')
  if (/(text-ranking|reranking)/.test(pipeline)
    || has(/(?:^|[\s._-])(rerank|reranker|cross-encoder)(?:$|[\s._-])/)) add('rerank')
  if (has(/(?:^|[\s._-])(tool[-_ ]?use|tool[-_ ]?calling|function[-_ ]?calling|functionary|hermes|agent)(?:$|[\s._-])/)) add('tools')
  if (has(/(?:^|[\s._-])(reasoning|deepseek-r1|qwq|r1-distill|o1|o3)(?:$|[\s._-])/)) add('reasoning')
  if (has(/(?:^|[\s._-])(code|coder|coding|programming|starcoder|codegen)(?:$|[\s._-])/)) add('code')

  const generative = !['feature-extraction', 'sentence-similarity', 'text-ranking', 'reranking', 'automatic-speech-recognition', 'text-to-speech', 'audio-classification'].includes(pipeline)
  if (generative) add('chat')
  return result
}

/** Keep only safe, compact Hugging Face metadata for the local model catalog. */
export function sanitizeHubRepositoryMetadata(input, repoId) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const tags = (Array.isArray(source.tags) ? source.tags : [])
    .filter((tag) => typeof tag === 'string' && tag.length <= 100)
    .slice(0, 100)
  const sources = (Array.isArray(source.sources) ? source.sources : [source.source])
    .filter((item) => item === 'llama.cpp' || item === 'gguf')
  const pipelineTag = cleanString(source.pipelineTag || source.pipeline_tag).slice(0, 100)
  const revision = safeHubRevision(source.revision || source.sha || 'main')
  const mmprojFilename = source.mmprojFilename ? safeHubFilename(source.mmprojFilename) : ''
  if (mmprojFilename && !/mmproj/i.test(pathBasenamePortable(mmprojFilename))) throw new Error('Дополнительный файл должен быть mmproj GGUF.')
  const additionalFiles = sanitizeAdditionalHubFiles(source.additionalFiles || [])
  return {
    repoId: safeHubRepoId(repoId),
    pipelineTag,
    tags,
    sources: [...new Set(sources)],
    llamaCppListed: sources.includes('llama.cpp'),
    capabilities: inferModelCapabilities(repoId, pipelineTag, tags),
    revision,
    mmprojFilename,
    additionalFiles,
    metadataSource: 'huggingface',
  }
}

/** Build small, server-side Hugging Face searches. Parameter count uses the Hub's num_parameters filter. */
export function buildHubSearchUrls(query, sort = 'trending', paramsRange = 'any') {
  const q = cleanString(query)
  const sortField = HUB_SORT_FIELDS[sort] || HUB_SORT_FIELDS.trending
  const parameterFilter = HUB_PARAMETER_FILTERS[paramsRange] || ''
  const makeUrl = (filterKind) => {
    const url = new URL('https://huggingface.co/api/models')
    if (q) url.searchParams.set('search', q)
    url.searchParams.set('limit', '30')
    url.searchParams.set('sort', sortField)
    url.searchParams.set('direction', '-1')
    if (parameterFilter) url.searchParams.set('num_parameters', parameterFilter)
    for (const field of ['siblings', 'author', 'downloads', 'likes', 'lastModified', 'library_name', 'pipeline_tag', 'tags', 'sha']) {
      url.searchParams.append('expand[]', field)
    }
    if (filterKind === 'llama.cpp') url.searchParams.set('apps', 'llama.cpp')
    else url.searchParams.set('filter', 'gguf')
    return url.toString()
  }
  return [
    { kind: 'llama.cpp', url: makeUrl('llama.cpp') },
    { kind: 'gguf', url: makeUrl('gguf') },
  ]
}

export function safeHubRevision(value) {
  const revision = cleanString(value, 'main') || 'main'
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(revision)) throw new Error('Некорректная ревизия Hugging Face.')
  return revision
}

function pathBasenamePortable(value) {
  return String(value).split(/[\\/]/).pop() || ''
}

export function buildHubTreeUrl(repoId, revision = 'main') {
  const repo = safeHubRepoId(repoId)
  const rev = safeHubRevision(revision)
  const encodedRepo = repo.split('/').map(encodeURIComponent).join('/')
  return `https://huggingface.co/api/models/${encodedRepo}/tree/${encodeURIComponent(rev)}?recursive=true`
}

/** Read the next Link-header page only when it stays on the same public Hub tree endpoint. */
export function getNextHubTreePageUrl(linkHeader, currentUrl, repoId, revision = 'main') {
  const header = cleanString(linkHeader)
  if (!header) return ''
  const expectedPrefix = new URL(buildHubTreeUrl(repoId, revision)).pathname
  const links = [...header.matchAll(/<([^>]+)>\s*;\s*rel=\"?([^;\"]+)\"?/gi)]
  const next = links.find((match) => cleanString(match[2]).toLowerCase() === 'next')
  if (!next) return ''
  let resolved
  try { resolved = new URL(next[1], currentUrl) } catch { throw new Error('Hugging Face вернул некорректную ссылку следующей страницы.') }
  if (resolved.protocol !== 'https:' || resolved.hostname !== 'huggingface.co' || resolved.pathname !== expectedPrefix) {
    throw new Error('Hugging Face вернул ссылку за пределами дерева выбранного репозитория.')
  }
  return resolved.toString()
}

function normalizedHubFile(file, repoId) {
  const name = cleanString(file.path || file.rfilename || file.name)
  const sizeBytes = hubFileSize(file)
  return {
    name,
    sizeBytes,
    sizeLabel: sizeBytes ? formatBytes(sizeBytes) : '',
    quantization: extractQuantization(name),
    parameterCountB: extractParameterCountB(name) ?? extractParameterCountB(repoId),
  }
}

function groupShardedGguf(files) {
  const ordinary = []
  const groups = new Map()
  for (const file of files) {
    const match = file.name.match(/^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i)
    if (!match) {
      ordinary.push({ ...file, downloadFiles: [{ name: file.name, sizeBytes: file.sizeBytes }] })
      continue
    }
    const key = match[1]
    const partNumber = Number(match[2])
    const totalParts = Number(match[3])
    const group = groups.get(key) || { totalParts, parts: [] }
    if (group.totalParts !== totalParts) continue
    group.parts.push({ ...file, partNumber })
    groups.set(key, group)
  }
  for (const [key, group] of groups) {
    const sorted = group.parts.sort((a, b) => a.partNumber - b.partNumber)
    if (!group.totalParts || sorted.length !== group.totalParts || sorted.some((part, index) => part.partNumber !== index + 1)) continue
    const first = sorted[0]
    const totalSize = sorted.reduce((sum, part) => sum + (Number(part.sizeBytes) || 0), 0)
    ordinary.push({
      ...first,
      name: first.name,
      baseName: key,
      sizeBytes: totalSize,
      sizeLabel: totalSize ? formatBytes(totalSize) : '',
      shardCount: sorted.length,
      downloadFiles: sorted.map(({ name, sizeBytes }) => ({ name, sizeBytes })),
    })
  }
  return ordinary
}

/**
 * Parse a complete GGUF inventory. Projectors are kept separately and are only
 * attached after a user chooses the matching file; shard groups are emitted
 * only when every numbered part is present.
 */
export function sanitizeHubTreeInventory(data, repoId = '') {
  if (!Array.isArray(data)) return { files: [], projectors: [], incompleteShards: [] }
  const candidates = []
  const projectors = []
  const shardParts = new Map()
  const incompleteShards = []
  for (const item of data) {
    if (!item || typeof item !== 'object' || (item.type && item.type !== 'file')) continue
    const name = cleanString(item.path || item.rfilename || item.name)
    if (!/\.gguf$/i.test(name)) continue
    const normalized = normalizedHubFile(item, repoId)
    if (/mmproj/i.test(pathBasenamePortable(name))) {
      projectors.push({ ...normalized, role: 'mmproj' })
      continue
    }
    const part = name.match(/^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i)
    if (part) {
      const key = part[1]
      const total = Number(part[3])
      const group = shardParts.get(key) || { total, parts: [] }
      if (group.total === total) group.parts.push({ ...normalized, partNumber: Number(part[2]) })
      shardParts.set(key, group)
      continue
    }
    candidates.push(normalized)
  }
  for (const [key, group] of shardParts) {
    const parts = group.parts.sort((a, b) => a.partNumber - b.partNumber)
    if (parts.length !== group.total || parts.some((part, index) => part.partNumber !== index + 1)) {
      incompleteShards.push({ baseName: key, expectedParts: group.total, foundParts: parts.length })
      continue
    }
    candidates.push({
      ...parts[0],
      baseName: key,
      sizeBytes: parts.reduce((sum, part) => sum + (Number(part.sizeBytes) || 0), 0),
      sizeLabel: formatBytes(parts.reduce((sum, part) => sum + (Number(part.sizeBytes) || 0), 0)),
      shardCount: parts.length,
      downloadFiles: parts.map(({ name, sizeBytes }) => ({ name, sizeBytes })),
    })
  }
  const files = candidates.sort((a, b) =>
    (a.sizeBytes || Number.MAX_SAFE_INTEGER) - (b.sizeBytes || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
  projectors.sort((a, b) => (a.sizeBytes || Number.MAX_SAFE_INTEGER) - (b.sizeBytes || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
  return { files, projectors, incompleteShards }
}

/** Backwards-compatible view used by older callers and tests. */
export function sanitizeHubTreeFiles(data, repoId = '') {
  return sanitizeHubTreeInventory(data, repoId).files
}

/** Only public GGUF component files can be downloaded as a model bundle. */
export function sanitizeAdditionalHubFiles(input) {
  if (!Array.isArray(input)) return []
  const seen = new Set()
  const result = []
  for (const item of input) {
    const source = typeof item === 'string' ? { name: item } : item
    if (!source || typeof source !== 'object') continue
    const name = safeHubFilename(source.name || source.path)
    if (seen.has(name)) continue
    seen.add(name)
    const sizeBytes = Number(source.sizeBytes || source.size) || 0
    result.push({ name, sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0 })
  }
  return result
}

/** Build a validated, deterministic download bundle for one GGUF and its optional projector/shards. */
export function buildHubDownloadPlan(filename, metadata = {}) {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  const mainFile = safeHubFilename(filename)
  if (/mmproj/i.test(pathBasenamePortable(mainFile))) throw new Error('Выбери основной GGUF, а не mmproj-проектор.')
  const revision = safeHubRevision(source.revision || source.sha || 'main')
  const supplied = sanitizeAdditionalHubFiles(source.downloadFiles || [])
  const mainFiles = supplied.length ? supplied : [{ name: mainFile, sizeBytes: Number(source.sizeBytes) || 0 }]
  if (!mainFiles.some((file) => file.name === mainFile)) mainFiles.unshift({ name: mainFile, sizeBytes: Number(source.sizeBytes) || 0 })

  // A selected split model is downloadable only when every shard in the set is present.
  const selectedShard = mainFile.match(/^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i)
  if (selectedShard) {
    const prefix = selectedShard[1]
    const total = Number(selectedShard[3])
    const parts = new Map()
    for (const file of mainFiles) {
      const match = file.name.match(/^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i)
      if (!match || match[1] !== prefix || Number(match[3]) !== total) throw new Error('Набор GGUF-частей содержит посторонний файл или другую группу.')
      const partNumber = Number(match[2])
      if (parts.has(partNumber)) throw new Error(`Повторяется GGUF-часть ${partNumber}.`)
      parts.set(partNumber, file)
    }
    if (parts.size !== total || Array.from({ length: total }, (_, index) => index + 1).some((number) => !parts.has(number))) {
      throw new Error(`Неполный GGUF-комплект: требуется ${total} частей, получено ${parts.size}. Загрузка отменена.`)
    }
    mainFiles.splice(0, mainFiles.length, ...Array.from({ length: total }, (_, index) => parts.get(index + 1)))
  } else {
    if (mainFiles.length !== 1 || mainFiles[0].name !== mainFile) throw new Error('Для обычной GGUF-модели нельзя добавлять посторонние GGUF-файлы в основной комплект.')
  }

  const projectorFile = source.mmprojFilename ? safeHubFilename(source.mmprojFilename) : ''
  if (projectorFile && !/mmproj/i.test(pathBasenamePortable(projectorFile))) {
    throw new Error('Дополнительный файл должен быть mmproj-проектором GGUF.')
  }
  if (projectorFile && mainFiles.some((file) => file.name === projectorFile)) throw new Error('mmproj не может совпадать с основным файлом или shard-частью.')
  const files = mainFiles.map((file, index) => ({ ...file, role: index === 0 ? 'main' : 'shard' }))
  if (projectorFile) {
    const projector = sanitizeAdditionalHubFiles([{ name: projectorFile, sizeBytes: Number(source.mmprojSizeBytes) || 0 }])[0]
    files.push({ ...projector, role: 'mmproj' })
  }
  return {
    revision,
    mainFile,
    mmprojFile: projectorFile,
    displayName: cleanString(source.displayName),
    files,
    expectedBytes: files.reduce((sum, file) => sum + (Number(file.sizeBytes) || 0), 0),
  }
}

/** Apply a file-size filter to exact GGUF sizes; unknown sizes are excluded when a range is selected. */
export function filterHubModelsByWeight(models, weightRange = 'any') {
  const range = HUB_WEIGHT_RANGES[weightRange]
  if (!range) return Array.isArray(models) ? models : []
  const filtered = []
  for (const model of Array.isArray(models) ? models : []) {
    const files = (model.files || []).filter((file) => {
      const size = Number(file.sizeBytes)
      return Number.isFinite(size) && size > 0 && size >= range.min && size < range.max
    })
    if (files.length) filtered.push({ ...model, files, fileCount: files.length })
  }
  return filtered
}

function hubFileName(file) {
  if (typeof file === 'string') return file
  if (!file || typeof file !== 'object') return ''
  return cleanString(file.rfilename || file.path || file.name)
}

function hubFileSize(file) {
  if (!file || typeof file !== 'object') return 0
  const values = [file.size, file.lfs && file.lfs.size, file.xetHash && file.size]
  for (const value of values) {
    const size = Number(value)
    if (Number.isFinite(size) && size > 0) return size
  }
  return 0
}

/** Normalize Hub model hits while retaining projector and complete shard metadata when available. */
export function sanitizeHubModels(data, source = 'gguf') {
  if (!Array.isArray(data)) return []
  const result = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const id = cleanString(item.id || item.modelId)
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) continue
    const siblings = Array.isArray(item.siblings) ? item.siblings : (Array.isArray(item.files) ? item.files : [])
    const inventory = sanitizeHubTreeInventory(siblings.map((file) => ({ ...file, path: hubFileName(file), type: 'file' })), id)
    const files = inventory.files
    if (!files.length) continue
    const capabilities = inferModelCapabilities(id, item.pipeline_tag || item.pipelineTag, item.tags)
    if (inventory.projectors.length && !capabilities.some((entry) => entry.id === 'vision')) capabilities.push(CAPABILITY_DEFINITIONS.vision)
    const author = cleanString(item.author) || id.split('/')[0]
    result.push({
      id,
      author,
      revision: cleanString(item.sha) || 'main',
      parameterCountB: extractParameterCountB(id),
      downloads: Number(item.downloads) || 0,
      likes: Number(item.likes) || 0,
      lastModified: cleanString(item.lastModified || item.last_modified),
      libraryName: cleanString(item.library_name || item.libraryName),
      pipelineTag: cleanString(item.pipeline_tag || item.pipelineTag),
      tags: (Array.isArray(item.tags) ? item.tags : []).filter((tag) => typeof tag === 'string').slice(0, 100),
      capabilities,
      files,
      projectors: inventory.projectors,
      incompleteShards: inventory.incompleteShards,
      fileCount: files.length,
      source,
      llamaCppListed: source === 'llama.cpp',
    })
  }
  return result
}

export function mergeHubSearchResults(groups, limit = 24) {
  const merged = new Map()
  for (const group of groups) {
    for (const model of group || []) {
      const prior = merged.get(model.id)
      if (!prior) {
        merged.set(model.id, { ...model, sources: [model.source] })
        continue
      }
      const files = new Map(prior.files.map((file) => [file.name, file]))
      for (const file of model.files) {
        const old = files.get(file.name)
        if (!old || (!old.sizeBytes && file.sizeBytes)) files.set(file.name, { ...old, ...file })
      }
      prior.files = [...files.values()].sort((a, b) => (a.sizeBytes || Number.MAX_SAFE_INTEGER) - (b.sizeBytes || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
      prior.fileCount = prior.files.length
      const projectors = new Map((prior.projectors || []).map((file) => [file.name, file]))
      for (const file of model.projectors || []) {
        const old = projectors.get(file.name)
        if (!old || (!old.sizeBytes && file.sizeBytes)) projectors.set(file.name, { ...old, ...file })
      }
      prior.projectors = [...projectors.values()]
      prior.incompleteShards = [...(prior.incompleteShards || []), ...(model.incompleteShards || [])]
      if (!prior.revision || prior.revision === 'main') prior.revision = model.revision || prior.revision
      if (!prior.parameterCountB) prior.parameterCountB = model.parameterCountB || null
      prior.downloads = Math.max(prior.downloads, model.downloads)
      prior.likes = Math.max(prior.likes, model.likes)
      if (!prior.lastModified) prior.lastModified = model.lastModified
      if (!prior.pipelineTag) prior.pipelineTag = model.pipelineTag
      if (!prior.tags || !prior.tags.length) prior.tags = model.tags || []
      if (!prior.capabilities || !prior.capabilities.length) prior.capabilities = model.capabilities || []
      prior.llamaCppListed = prior.llamaCppListed || model.llamaCppListed || model.source === 'llama.cpp'
      if (!prior.sources.includes(model.source)) prior.sources.push(model.source)
    }
  }
  // Preserve the Hub order of the primary llama.cpp query; GGUF-only fallback results follow it.
  return [...merged.values()].slice(0, limit)
}

export function safeHubRepoId(value) {
  const repo = cleanString(value)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo)) {
    throw new Error('Некорректный Hugging Face repository ID.')
  }
  return repo
}

export function safeHubFilename(value) {
  const filename = cleanString(value).replace(/\\/g, '/')
  if (!filename || filename.startsWith('/') || filename.split('/').some((part) => !part || part === '.' || part === '..') || !/\.gguf$/i.test(filename)) {
    throw new Error('Можно скачивать только GGUF-файлы из публичного репозитория.')
  }
  return filename
}

export function buildHubDownloadUrl(repoId, filename, revision = 'main') {
  const repo = safeHubRepoId(repoId)
  const file = safeHubFilename(filename)
  const rev = safeHubRevision(revision)
  return `https://huggingface.co/${repo}/resolve/${encodeURIComponent(rev)}/${file.split('/').map(encodeURIComponent).join('/')}?download=true`
}
