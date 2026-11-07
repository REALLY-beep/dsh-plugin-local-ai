import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('context patch installer snapshots the shipped standard preset and verifies effective policy', async () => {
  const script = await fs.readFile(path.join(root, 'scripts', 'Apply-DSH-LocalAI-ContextPatch.ps1'), 'utf8')
  assert.match(script, /--dump-default-config/)
  assert.match(script, /preset-standard/)
  assert.match(script, /nextIndent.*Length -le \$indent/)
  assert.match(script, /compaction-basic/)
  assert.match(script, /headroomTokens/)
  assert.match(script, /maxTokens/)
  assert.match(script, /CompactionHeadroomTokens = 1024/)
  assert.match(script, /CompactionMaxTokens = 1024/)
  assert.match(script, /config\.id:\s*standard/)
  assert.match(script, /while \(\$true\)/)
  const launcher = await fs.readFile(path.join(root, 'APPLY-CONTEXT-FIX.cmd'), 'utf8')
  assert.match(launcher, /Apply-DSH-LocalAI-ContextPatch\.ps1/)
  assert.match(script, /Copy-Item -LiteralPath \$patchPath -Destination \$backupPath/)
  assert.match(script, /--dump-config/)
  assert.match(script, /Исходный cordis\.patch\.yml восстановлен/)
  assert.doesNotMatch(script, /Remove-Item.*local-ai-models/i)
})

test('context slider displays a live GiB KV-cache estimate from GGUF geometry', async () => {
  const client = await fs.readFile(path.join(root, 'lib', 'client.js'), 'utf8')
  const host = await fs.readFile(path.join(root, 'lib', 'index.js'), 'utf8')
  assert.match(client, /KV-cache ≈ \$\{gib\.toFixed\(2\)\} GiB/)
  assert.match(client, /K\/V F16/)
  assert.match(client, /не полный расход RAM\/VRAM/)
  assert.match(host, /bytesPerToken: model\.ggufContextMetadata\.bytesPerToken/)
  assert.match(host, /estimateKvCacheBytes\(model\.ggufContextMetadata/)
  assert.match(host, /ggufContextMetadata: undefined/)
})
