import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { scanGgufDirectory } from '../lib/model-scanner.js'

async function withTempDirectory(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-local-ai-scan-'))
  try { await run(root) } finally { await fs.rm(root, { recursive: true, force: true }) }
}

test('recursive scanner finds GGUF files at arbitrary nesting depths', async () => {
  await withTempDirectory(async (root) => {
    await fs.mkdir(path.join(root, 'Qwen', '8B', 'Q4'), { recursive: true })
    await fs.mkdir(path.join(root, 'Llama', 'Quantizations'), { recursive: true })
    await fs.writeFile(path.join(root, 'root-model.gguf'), 'root')
    await fs.writeFile(path.join(root, 'Qwen', '8B', 'Q4', 'qwen-q4.gguf'), 'nested')
    await fs.writeFile(path.join(root, 'Llama', 'Quantizations', 'llama-q5.GGUF'), 'deeper')
    await fs.writeFile(path.join(root, 'Llama', 'Quantizations', 'mmproj-model.gguf'), 'projector')
    await fs.writeFile(path.join(root, 'readme.txt'), 'not a model')

    const result = await scanGgufDirectory(root)
    assert.deepEqual(result.files.map((file) => file.relativePath), [
      path.join('Llama', 'Quantizations', 'llama-q5.GGUF'),
      path.join('Qwen', '8B', 'Q4', 'qwen-q4.gguf'),
      'root-model.gguf',
    ])
    assert.equal(result.files.length, 3)
    assert.equal(result.directoriesScanned, 6)
    assert.equal(result.skippedDirectories, 0)
    assert.equal(result.skippedFiles, 0)
    assert.equal(result.files.find((file) => file.name === 'root-model.gguf').sizeBytes, 4)
  })
})

test('recursive scanner does not follow symlinked directories', async (t) => {
  await withTempDirectory(async (root) => {
    const selected = path.join(root, 'selected')
    const outside = path.join(root, 'outside')
    await fs.mkdir(selected)
    await fs.mkdir(outside)
    await fs.writeFile(path.join(outside, 'outside.gguf'), 'outside')
    try {
      await fs.symlink(outside, path.join(selected, 'linked-folder'), 'dir')
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        t.skip(`Symlinks are unavailable in this environment (${error.code})`)
        return
      }
      throw error
    }

    const result = await scanGgufDirectory(selected)
    assert.equal(result.files.length, 0)
    assert.equal(result.directoriesScanned, 1)
  })
})

test('recursive scanner validates the selected path', async () => {
  await assert.rejects(() => scanGgufDirectory('   '), /Укажи путь/)
  await withTempDirectory(async (root) => {
    const file = path.join(root, 'not-a-folder.txt')
    await fs.writeFile(file, 'x')
    await assert.rejects(() => scanGgufDirectory(file), /не является папкой/)
  })
})
