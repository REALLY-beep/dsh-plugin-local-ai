import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MODEL_OPTIONS,
  DEFAULT_SETTINGS,
  buildHubDownloadUrl,
  buildHubSearchUrls,
  buildHubSearchQueries,
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
})

test('Hugging Face results keep standalone GGUF files and discard projectors and split shards', () => {
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
