import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MODEL_OPTIONS,
  DEFAULT_SETTINGS,
  buildHubDownloadUrl,
  buildHubDownloadPlan,
  sanitizeHubTreeInventory,
  buildHubSearchUrls,
  buildHubSearchQueries,
  buildHubTreeUrl,
  getNextHubTreePageUrl,
  extractParameterCountB,
  extractQuantization,
  filterHubModelsByWeight,
  sanitizeHubTreeFiles,
  buildServerArgs,
  describeModelFile,
  formatBytes,
  modelIdFromPath,
  normalizeModelOptions,
  normalizeSettings,
  safeHubFilename,
  safeHubRepoId,
  sanitizeHubModels,
  mergeHubSearchResults,
  inferModelCapabilities,
  describeCapabilitySupport,
  withCapabilitySupport,
  sanitizeHubRepositoryMetadata,
} from '../lib/logic.js'

test('settings normalization rejects invalid ports and keeps safe defaults', () => {
  const settings = normalizeSettings({ port: 80, apiKey: ' test ' })
  assert.equal(settings.port, DEFAULT_SETTINGS.port)
  assert.equal(settings.apiKey, 'test')
  assert.equal(settings.modelsDir, DEFAULT_SETTINGS.modelsDir)
})

test('model option normalization clamps invalid values to defaults', () => {
  const options = normalizeModelOptions({ contextSize: -1, gpuLayers: 99999, temperature: 1.25, flashAttention: false })
  assert.equal(options.contextSize, DEFAULT_MODEL_OPTIONS.contextSize)
  assert.equal(options.gpuLayers, DEFAULT_MODEL_OPTIONS.gpuLayers)
  assert.equal(options.temperature, 1.25)
  assert.equal(options.flashAttention, false)
})

test('llama-server argv keeps values separate from shell syntax', () => {
  const argv = buildServerArgs({
    executable: 'C:\\llama folder\\llama-server.exe',
    modelPath: 'D:\\Models\\my model; & test.gguf',
    port: 12345,
    apiKey: 'secret key',
    alias: 'my local model',
    options: { contextSize: 16384, gpuLayers: 32, threads: 6, batchSize: 256 },
  })
  assert.equal(argv[0], 'C:\\llama folder\\llama-server.exe')
  assert.equal(argv[2], 'D:\\Models\\my model; & test.gguf')
  assert.ok(argv.includes('secret key'))
  assert.ok(argv.includes('--ctx-size'))
  assert.deepEqual(argv.slice(argv.indexOf('--alias'), argv.indexOf('--alias') + 2), ['--alias', 'my local model'])
  assert.ok(!argv.some((part) => part.includes('&&')))
})

test('model metadata gets a stable ID and quantization label', () => {
  const first = modelIdFromPath('C:/Models/Qwen3-8B-Q4_K_M.gguf')
  const second = modelIdFromPath('c:/models/qwen3-8b-q4_k_m.gguf')
  assert.equal(first, second)
  const model = describeModelFile('/models/Qwen3-8B-Q4_K_M.gguf', 1024 * 1024)
  assert.equal(model.quantization, 'Q4_K_M')
  assert.equal(model.sizeLabel, '1.00 MB')
})

test('Hugging Face repository and filename validation blocks traversal', () => {
  assert.equal(safeHubRepoId('bartowski/Qwen3-8B-GGUF'), 'bartowski/Qwen3-8B-GGUF')
  assert.throws(() => safeHubRepoId('https://evil.example/user/model'))
  assert.equal(safeHubFilename('Qwen3/Qwen3-8B-Q4_K_M.gguf'), 'Qwen3/Qwen3-8B-Q4_K_M.gguf')
  assert.throws(() => safeHubFilename('../../outside.gguf'))
  assert.throws(() => safeHubFilename('README.md'))
})

test('Hugging Face URL is fixed to the public host and encodes path segments', () => {
  const url = buildHubDownloadUrl('bartowski/Qwen3-8B-GGUF', 'Qwen3-8B-Q4_K_M.gguf')
  assert.equal(url, 'https://huggingface.co/bartowski/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf?download=true')
  assert.throws(() => buildHubDownloadUrl('https://evil.example/a', 'model.gguf'))
})

test('human-readable byte sizes', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1024), '1.00 KB')
  assert.equal(formatBytes(1024 * 1024 * 1024), '1.00 GB')
})


test('Hugging Face search mirrors llama.cpp model discovery and has a GGUF fallback', () => {
  const requests = buildHubSearchUrls('Qwen3', 'trending')
  assert.equal(requests.length, 2)
  const primary = new URL(requests[0].url)
  const fallback = new URL(requests[1].url)
  assert.equal(primary.searchParams.get('search'), 'Qwen3')
  assert.equal(primary.searchParams.get('apps'), 'llama.cpp')
  assert.equal(primary.searchParams.get('sort'), 'trendingScore')
  assert.equal(primary.searchParams.get('expand[]'), 'siblings')
  assert.equal(fallback.searchParams.get('filter'), 'gguf')
  assert.equal(fallback.searchParams.get('sort'), 'trendingScore')
  const filtered = buildHubSearchUrls('Qwen3', 'downloads', 'from8To14B')
  assert.equal(new URL(filtered[0].url).searchParams.get('num_parameters'), 'min:8B,max:14B')
  assert.equal(new URL(filtered[1].url).searchParams.get('num_parameters'), 'min:8B,max:14B')
})

test('Hugging Face results keep projector metadata and reject incomplete split-shard groups', () => {
  const models = sanitizeHubModels([{
    id: 'bartowski/Qwen3-GGUF',
    downloads: 1200,
    likes: 12,
    lastModified: '2026-11-01T00:00:00.000Z',
    siblings: [
      { rfilename: 'Qwen3-Q4_K_M.gguf', size: 1234 },
      { rfilename: 'mmproj-Qwen3.gguf', size: 100 },
      { rfilename: 'Qwen3-00001-of-00002.gguf', size: 500 },
      { rfilename: 'README.md', size: 10 },
    ],
  }], 'llama.cpp')
  assert.equal(models.length, 1)
  assert.equal(models[0].author, 'bartowski')
  assert.equal(models[0].fileCount, 1)
  assert.equal(models[0].files[0].name, 'Qwen3-Q4_K_M.gguf')
  assert.equal(models[0].files[0].sizeBytes, 1234)
})

test('Hugging Face results merge duplicate repos and retain their files', () => {
  const base = { id: 'bartowski/Example-GGUF', author: 'bartowski', downloads: 20, likes: 2, lastModified: '', fileCount: 1, source: 'llama.cpp', files: [{ name: 'A-Q4.gguf', sizeBytes: 10 }] }
  const fallback = { ...base, source: 'gguf', downloads: 22, files: [{ name: 'B-Q5.gguf', sizeBytes: 20 }] }
  const merged = mergeHubSearchResults([[base], [fallback]])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].downloads, 22)
  assert.deepEqual(merged[0].sources, ['llama.cpp', 'gguf'])
  assert.deepEqual(merged[0].files.map((file) => file.name), ['A-Q4.gguf', 'B-Q5.gguf'])
})


test('Hugging Face search normalizes spaced model names and has a family fallback', () => {
  assert.deepEqual(buildHubSearchQueries('Qwen3 8B GGUF'), ['Qwen3 8B GGUF', 'Qwen3-8B-GGUF', 'Qwen3'])
  assert.deepEqual(buildHubSearchQueries('Qwen3'), ['Qwen3'])
  assert.deepEqual(buildHubSearchQueries(''), [''])
})



test('Hugging Face tree pagination follows only same-repository HTTPS next links', () => {
  const current = buildHubTreeUrl('user/model', 'a'.repeat(40))
  const next = 'https://huggingface.co/api/models/user/model/tree/' + 'a'.repeat(40) + '?recursive=true&cursor=next-token'
  assert.equal(
    getNextHubTreePageUrl(`<${next}>; rel="next", <${current}>; rel="first"`, current, 'user/model', 'a'.repeat(40)),
    next,
  )
  assert.equal(getNextHubTreePageUrl(`<${current}>; rel="prev"`, current, 'user/model', 'a'.repeat(40)), '')
  assert.throws(() => getNextHubTreePageUrl('<https://evil.example/next>; rel="next"', current, 'user/model', 'a'.repeat(40)), /за пределами дерева/)
  assert.throws(() => getNextHubTreePageUrl(`<https://huggingface.co/api/models/user/other/tree/${'a'.repeat(40)}?cursor=x>; rel="next"`, current, 'user/model', 'a'.repeat(40)), /за пределами дерева/)
})

test('Hugging Face GGUF metadata parses parameter count, quantization and exact tree file size', () => {
  assert.equal(extractParameterCountB('bartowski/Qwen3-8B-GGUF'), 8)
  assert.equal(extractParameterCountB('Qwen3.5-9B-Q4_K_M.gguf'), 9)
  assert.equal(extractParameterCountB('ibm-granite/granite-4.0-h-micro-GGUF'), null)
  assert.equal(extractQuantization('Qwen3-8B-Q4_K_M.gguf'), 'Q4_K_M')
  assert.equal(buildHubTreeUrl('bartowski/Qwen3-8B-GGUF'), 'https://huggingface.co/api/models/bartowski/Qwen3-8B-GGUF/tree/main?recursive=true')
  assert.throws(() => buildHubTreeUrl('https://example.com/repo'))

  const files = sanitizeHubTreeFiles([
    { type: 'file', path: 'Qwen3-8B-Q4_K_M.gguf', size: 4 * 1024 ** 3 },
    { type: 'file', path: 'Qwen3-8B-Q8_0.gguf', size: 8 * 1024 ** 3 },
    { type: 'file', path: 'mmproj-Qwen3.gguf', size: 100 },
    { type: 'file', path: 'Qwen3-00001-of-00002.gguf', size: 100 },
    { type: 'directory', path: 'weights' },
  ], 'bartowski/Qwen3-8B-GGUF')
  assert.equal(files.length, 2)
  assert.equal(files[0].parameterCountB, 8)
  assert.equal(files[0].quantization, 'Q4_K_M')
  assert.equal(files[0].sizeBytes, 4 * 1024 ** 3)
  assert.equal(files[0].sizeLabel, '4.00 GB')
})

test('Hugging Face GGUF weight filter filters individual quant files by exact byte size', () => {
  const models = [{
    id: 'bartowski/Qwen3-8B-GGUF',
    files: [
      { name: 'Qwen3-8B-Q3.gguf', sizeBytes: 1.5 * 1024 ** 3 },
      { name: 'Qwen3-8B-Q4.gguf', sizeBytes: 4 * 1024 ** 3 },
      { name: 'Qwen3-8B-Q8.gguf', sizeBytes: 8 * 1024 ** 3 },
      { name: 'Qwen3-8B-unknown.gguf', sizeBytes: 0 },
    ],
    fileCount: 4,
  }]
  const filtered = filterHubModelsByWeight(models, 'from2To5GB')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].fileCount, 1)
  assert.equal(filtered[0].files[0].name, 'Qwen3-8B-Q4.gguf')
  assert.equal(filterHubModelsByWeight(models, 'from20GB').length, 0)
  assert.equal(filterHubModelsByWeight(models, 'any')[0].fileCount, 4)
})


test('Hugging Face metadata exposes conservative model capability hints', () => {
  const models = sanitizeHubModels([{
    id: 'Qwen/Qwen2.5-VL-7B-Instruct',
    pipeline_tag: 'image-text-to-text',
    tags: ['transformers', 'vision', 'tool-calling'],
    siblings: [{ rfilename: 'Qwen2.5-VL-7B-Q4_K_M.gguf', size: 1024 }],
  }], 'llama.cpp')
  assert.equal(models.length, 1)
  assert.equal(models[0].pipelineTag, 'image-text-to-text')
  assert.equal(models[0].llamaCppListed, true)
  assert.ok(models[0].capabilities.some((item) => item.id === 'vision'))
  assert.ok(models[0].capabilities.some((item) => item.id === 'tools'))
})

test('capability inference distinguishes code, reasoning, embeddings and audio tasks', () => {
  const code = inferModelCapabilities('Qwen/Qwen2.5-Coder-7B')
  assert.ok(code.some((item) => item.id === 'code'))
  const reasoning = inferModelCapabilities('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B')
  assert.ok(reasoning.some((item) => item.id === 'reasoning'))
  const embeddings = inferModelCapabilities('sentence-transformers/all-MiniLM-L6-v2', 'feature-extraction')
  assert.ok(embeddings.some((item) => item.id === 'embeddings'))
  assert.ok(!embeddings.some((item) => item.id === 'chat'))
  const audio = inferModelCapabilities('openai/whisper-large-v3', 'automatic-speech-recognition')
  assert.ok(audio.some((item) => item.id === 'audio'))
})

test('downloaded Hub metadata is compact and derives its own capability labels', () => {
  const metadata = sanitizeHubRepositoryMetadata({
    pipelineTag: 'text-generation',
    tags: ['code', 12, 'tools'],
    sources: ['llama.cpp', 'gguf', 'unsafe'],
  }, 'bartowski/Qwen-Coder-7B-GGUF')
  assert.equal(metadata.repoId, 'bartowski/Qwen-Coder-7B-GGUF')
  assert.equal(metadata.llamaCppListed, true)
  assert.deepEqual(metadata.tags, ['code', 'tools'])
  assert.ok(metadata.capabilities.some((item) => item.id === 'code'))
  assert.throws(() => sanitizeHubRepositoryMetadata({}, 'https://example.com/evil'))
})


test('describeCapabilitySupport separates model claims from plugin support', () => {
  assert.equal(describeCapabilitySupport('chat').status, 'supported')
  assert.equal(describeCapabilitySupport('code').status, 'supported')
  assert.equal(describeCapabilitySupport('tools').status, 'conditional')
  assert.equal(describeCapabilitySupport('tools', { options: { jinja: false } }).status, 'unsupported')
  assert.equal(describeCapabilitySupport('reasoning').status, 'conditional')
  assert.equal(describeCapabilitySupport('vision').status, 'conditional')
  assert.equal(describeCapabilitySupport('vision', { mmprojPath: 'mmproj-model-f16.gguf' }).status, 'conditional')
  assert.equal(describeCapabilitySupport('vision', { mmprojPath: 'mmproj-model-f16.gguf', visionVerifiedAt: '2026-11-07T00:00:00Z' }).status, 'supported')
  assert.equal(describeCapabilitySupport('audio').status, 'unsupported')
  assert.equal(describeCapabilitySupport('embeddings').status, 'unsupported')
  assert.equal(describeCapabilitySupport('rerank').status, 'unsupported')
})


test('withCapabilitySupport annotates model capability hints without mutating the model', () => {
  const original = { id: 'local', options: { jinja: false }, capabilities: [{ id: 'tools', label: 'Tools', icon: '🧰' }] }
  const result = withCapabilitySupport(original)
  assert.equal(result.capabilities[0].status, 'unsupported')
  assert.equal(result.capabilities[0].mark, '×')
  assert.equal(original.capabilities[0].status, undefined)
})


test('server command passes the selected multimodal projector as a separate argv value', () => {
  const argv = buildServerArgs({
    executable: 'E:\\llama\\llama-server.exe',
    modelPath: 'E:\\models\\gemma-3.gguf',
    mmprojPath: 'E:\\models\\mmproj-model-f16.gguf',
    port: 12345,
    apiKey: '',
    alias: 'gemma-3',
    options: { gpuLayers: 99 },
  })
  const index = argv.indexOf('--mmproj')
  assert.ok(index >= 0)
  assert.equal(argv[index + 1], 'E:\\models\\mmproj-model-f16.gguf')
})

test('Hugging Face download plan includes a paired mmproj and exact revision', () => {
  const plan = buildHubDownloadPlan('repo/model-Q4_K_M.gguf', {
    revision: 'a'.repeat(40),
    mmprojFilename: 'mmproj-model-f16.gguf',
    mmprojSizeBytes: 200,
    downloadFiles: [{ name: 'repo/model-Q4_K_M.gguf', sizeBytes: 1000 }],
  })
  assert.equal(plan.revision, 'a'.repeat(40))
  assert.equal(plan.files.length, 2)
  assert.equal(plan.files[0].role, 'main')
  assert.equal(plan.files[1].role, 'mmproj')
  assert.equal(plan.expectedBytes, 1200)
  assert.ok(buildHubDownloadUrl('user/model', plan.files[1].name, plan.revision).includes(`/resolve/${'a'.repeat(40)}/`))
})

test('Hugging Face download plan only accepts complete split-shard bundles', () => {
  const plan = buildHubDownloadPlan('model-00001-of-00002.gguf', {
    downloadFiles: [
      { name: 'model-00002-of-00002.gguf', sizeBytes: 200 },
      { name: 'model-00001-of-00002.gguf', sizeBytes: 100 },
    ],
    mmprojFilename: 'mmproj.gguf',
  })
  assert.deepEqual(plan.files.map((file) => file.name), [
    'model-00001-of-00002.gguf',
    'model-00002-of-00002.gguf',
    'mmproj.gguf',
  ])
  assert.throws(() => buildHubDownloadPlan('model-00001-of-00003.gguf', {
    downloadFiles: [{ name: 'model-00001-of-00003.gguf', sizeBytes: 100 }],
  }), /Неполный GGUF-комплект/)
  assert.throws(() => buildHubDownloadPlan('model.gguf', {
    downloadFiles: [{ name: 'model.gguf', sizeBytes: 100 }, { name: 'other.gguf', sizeBytes: 100 }],
  }), /посторонние GGUF-файлы/)
})

test('Hub tree inventory pairs projectors and records only complete shard groups', () => {
  const inventory = sanitizeHubTreeInventory([
    { path: 'model-00001-of-00002.gguf', size: 100, type: 'file' },
    { path: 'model-00002-of-00002.gguf', size: 200, type: 'file' },
    { path: 'mmproj-model-f16.gguf', size: 50, type: 'file' },
    { path: 'other-00001-of-00002.gguf', size: 80, type: 'file' },
  ], 'user/model')
  assert.equal(inventory.files.length, 1)
  assert.equal(inventory.files[0].shardCount, 2)
  assert.equal(inventory.files[0].downloadFiles.length, 2)
  assert.equal(inventory.projectors.length, 1)
  assert.equal(inventory.incompleteShards.length, 1)
})
