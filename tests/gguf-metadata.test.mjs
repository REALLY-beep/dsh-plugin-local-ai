import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readGgufContextMetadata } from '../lib/gguf-metadata.js'
import { estimateKvCacheBytes, formatGiB } from '../lib/logic.js'

function ggufString(value) {
  const bytes = Buffer.from(value, 'utf8')
  const length = Buffer.alloc(8)
  length.writeBigUInt64LE(BigInt(bytes.length))
  return Buffer.concat([length, bytes])
}

function ggufEntry(key, type, value) {
  const typeBuffer = Buffer.alloc(4)
  typeBuffer.writeUInt32LE(type)
  let valueBuffer
  if (type === 8) valueBuffer = ggufString(value)
  else {
    valueBuffer = Buffer.alloc(4)
    valueBuffer.writeUInt32LE(value)
  }
  return Buffer.concat([ggufString(key), typeBuffer, valueBuffer])
}

function makeGguf(entries) {
  const header = Buffer.alloc(24)
  header.write('GGUF', 0, 'ascii')
  header.writeUInt32LE(3, 4)
  header.writeBigUInt64LE(0n, 8) // tensor count; metadata-only fixture
  header.writeBigUInt64LE(BigInt(entries.length), 16)
  return Buffer.concat([header, ...entries])
}

test('GGUF metadata parser derives F16 transformer KV-cache bytes per token', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-gguf-meta-'))
  const file = path.join(directory, 'fixture.gguf')
  const entries = [
    ggufEntry('general.architecture', 8, 'llama'),
    ggufEntry('llama.block_count', 4, 32),
    ggufEntry('llama.embedding_length', 4, 4096),
    ggufEntry('llama.attention.head_count', 4, 32),
    ggufEntry('llama.attention.head_count_kv', 4, 8),
    ggufEntry('llama.attention.key_length', 4, 128),
    ggufEntry('llama.attention.value_length', 4, 128),
  ]
  await fs.writeFile(file, makeGguf(entries))
  try {
    const metadata = await readGgufContextMetadata(file)
    assert.equal(metadata.architecture, 'llama')
    assert.equal(metadata.blockCount, 32)
    assert.equal(metadata.attentionHeadsKv, 8)
    assert.equal(metadata.bytesPerToken, 131072)
    assert.equal(estimateKvCacheBytes(metadata, 8192), 1024 ** 3)
    assert.equal(formatGiB(estimateKvCacheBytes(metadata, 8192)), '1.00 GiB')
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test('GGUF metadata parser marks state-space metadata and safely returns null for non-GGUF files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-gguf-hybrid-'))
  const hybrid = path.join(directory, 'hybrid.gguf')
  const invalid = path.join(directory, 'not-gguf.bin')
  const entries = [
    ggufEntry('general.architecture', 8, 'granite'),
    ggufEntry('granite.block_count', 4, 28),
    ggufEntry('granite.embedding_length', 4, 2048),
    ggufEntry('granite.attention.head_count', 4, 16),
    ggufEntry('granite.attention.head_count_kv', 4, 4),
    ggufEntry('granite.ssm.state_size', 4, 128),
  ]
  await fs.writeFile(hybrid, makeGguf(entries))
  await fs.writeFile(invalid, 'not gguf')
  try {
    const metadata = await readGgufContextMetadata(hybrid)
    assert.equal(metadata.stateSpaceMetadata, true)
    assert.ok(metadata.bytesPerToken > 0)
    assert.equal(await readGgufContextMetadata(invalid), null)
    assert.equal(estimateKvCacheBytes(null, 8192), null)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
