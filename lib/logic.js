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

export function buildServerArgs({ executable, modelPath, port, apiKey, options, alias }) {
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
    options: { ...DEFAULT_MODEL_OPTIONS },
    addedAt: new Date().toISOString(),
  }
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

export function buildHubDownloadUrl(repoId, filename) {
  const repo = safeHubRepoId(repoId)
  const file = safeHubFilename(filename)
  return `https://huggingface.co/${repo}/resolve/main/${file.split('/').map(encodeURIComponent).join('/')}?download=true`
}
