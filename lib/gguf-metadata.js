import fs from 'node:fs/promises'

const FIXED_TYPE_SIZES = new Map([
  [0, 1],  // UINT8
  [1, 1],  // INT8
  [2, 2],  // UINT16
  [3, 2],  // INT16
  [4, 4],  // UINT32
  [5, 4],  // INT32
  [6, 4],  // FLOAT32
  [7, 1],  // BOOL
  [10, 8], // UINT64
  [11, 8], // INT64
  [12, 8], // FLOAT64
])

const MAX_METADATA_READ_BYTES = 64 * 1024 * 1024

function requireRange(buffer, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || length < 0 || offset < 0 || offset + length > buffer.length) {
    throw new Error('GGUF metadata is truncated or exceeds the safe read limit.')
  }
}

function readU32(buffer, state) {
  requireRange(buffer, state.offset, 4)
  const value = buffer.readUInt32LE(state.offset)
  state.offset += 4
  return value
}

function readU64(buffer, state) {
  requireRange(buffer, state.offset, 8)
  const value = buffer.readBigUInt64LE(state.offset)
  state.offset += 8
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('GGUF metadata length exceeds the safe integer range.')
  return Number(value)
}

function readString(buffer, state) {
  const length = readU64(buffer, state)
  requireRange(buffer, state.offset, length)
  const value = buffer.toString('utf8', state.offset, state.offset + length)
  state.offset += length
  return value
}

function readScalar(buffer, state, type) {
  if (type === 8) return readString(buffer, state)
  const size = FIXED_TYPE_SIZES.get(type)
  if (!size) throw new Error(`Unsupported GGUF metadata value type ${type}.`)
  requireRange(buffer, state.offset, size)
  let value
  switch (type) {
    case 0: value = buffer.readUInt8(state.offset); break
    case 1: value = buffer.readInt8(state.offset); break
    case 2: value = buffer.readUInt16LE(state.offset); break
    case 3: value = buffer.readInt16LE(state.offset); break
    case 4: value = buffer.readUInt32LE(state.offset); break
    case 5: value = buffer.readInt32LE(state.offset); break
    case 6: value = buffer.readFloatLE(state.offset); break
    case 7: value = buffer.readUInt8(state.offset) !== 0; break
    case 10: {
      const n = buffer.readBigUInt64LE(state.offset)
      value = n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null
      break
    }
    case 11: {
      const n = buffer.readBigInt64LE(state.offset)
      value = n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(n) : null
      break
    }
    case 12: value = buffer.readDoubleLE(state.offset); break
    default: throw new Error(`Unsupported GGUF metadata scalar type ${type}.`)
  }
  state.offset += size
  return value
}

function skipValue(buffer, state, type) {
  if (type !== 9) {
    if (type === 8) {
      const length = readU64(buffer, state)
      requireRange(buffer, state.offset, length)
      state.offset += length
      return
    }
    const size = FIXED_TYPE_SIZES.get(type)
    if (!size) throw new Error(`Unsupported GGUF metadata value type ${type}.`)
    requireRange(buffer, state.offset, size)
    state.offset += size
    return
  }

  const elementType = readU32(buffer, state)
  const count = readU64(buffer, state)
  if (elementType === 8) {
    for (let index = 0; index < count; index += 1) {
      const length = readU64(buffer, state)
      requireRange(buffer, state.offset, length)
      state.offset += length
    }
    return
  }
  const size = FIXED_TYPE_SIZES.get(elementType)
  if (!size) throw new Error(`Unsupported GGUF array element type ${elementType}.`)
  const byteLength = count * size
  requireRange(buffer, state.offset, byteLength)
  state.offset += byteLength
}

function pickArchitectureValue(values, architecture, suffix) {
  const direct = values.get(`${architecture}.${suffix}`)
  if (direct !== undefined) return direct
  // GGUF variants occasionally use an architecture prefix that differs from the display name.
  const ending = `.${suffix}`
  for (const [key, value] of values) if (key.endsWith(ending)) return value
  return undefined
}

/**
 * Read only the GGUF header/metadata needed for a transformer KV-cache estimate.
 * Tensor payloads are never read. This intentionally returns null for malformed,
 * unsupported, or unusually large headers instead of guessing from the filename.
 */
export async function readGgufContextMetadata(filePath) {
  let handle
  try {
    handle = await fs.open(filePath, 'r')
    const stat = await handle.stat()
    const length = Math.min(stat.size, MAX_METADATA_READ_BYTES)
    if (length < 24) return null
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    if (bytesRead < 24 || buffer.toString('ascii', 0, 4) !== 'GGUF') return null

    const state = { offset: 4 }
    const version = readU32(buffer, state)
    if (version < 2 || version > 3) return null
    readU64(buffer, state) // tensor count
    const metadataCount = readU64(buffer, state)
    if (metadataCount > 100000) return null

    const values = new Map()
    let sawStateSpace = false
    for (let index = 0; index < metadataCount; index += 1) {
      try {
        const key = readString(buffer, state)
        const type = readU32(buffer, state)
        if (/(?:^|\.)(?:ssm|mamba|recurrent|state_space)(?:\.|$)/i.test(key)) sawStateSpace = true

        const isNeeded = key === 'general.architecture'
          || /\.(?:block_count|embedding_length|attention\.head_count|attention\.head_count_kv|attention\.key_length|attention\.value_length)$/.test(key)
        if (isNeeded) values.set(key, readScalar(buffer, state, type))
        else skipValue(buffer, state, type)

      } catch {
        // Large tokenizer arrays can exceed the bounded header read. Preserve the
        // architecture fields already read rather than discarding a valid estimate.
        break
      }
    }

    const architecture = values.get('general.architecture')
    if (typeof architecture !== 'string' || !architecture) return null
    const blockCount = Number(pickArchitectureValue(values, architecture, 'block_count'))
    const embeddingLength = Number(pickArchitectureValue(values, architecture, 'embedding_length'))
    const attentionHeads = Number(pickArchitectureValue(values, architecture, 'attention.head_count'))
    const attentionHeadsKv = Number(pickArchitectureValue(values, architecture, 'attention.head_count_kv') || attentionHeads)
    const keyLengthValue = Number(pickArchitectureValue(values, architecture, 'attention.key_length'))
    const valueLengthValue = Number(pickArchitectureValue(values, architecture, 'attention.value_length'))
    const headDim = attentionHeads > 0 && embeddingLength > 0 ? embeddingLength / attentionHeads : 0
    const keyLength = keyLengthValue > 0 ? keyLengthValue : headDim
    const valueLength = valueLengthValue > 0 ? valueLengthValue : keyLength

    if (![blockCount, attentionHeadsKv, keyLength, valueLength].every((value) => Number.isFinite(value) && value > 0)) return null
    const bytesPerToken = Math.ceil(blockCount * attentionHeadsKv * (keyLength + valueLength) * 2)
    if (!Number.isFinite(bytesPerToken) || bytesPerToken <= 0) return null

    return {
      architecture,
      blockCount,
      attentionHeads,
      attentionHeadsKv,
      keyLength,
      valueLength,
      bytesPerToken,
      cacheType: 'f16',
      stateSpaceMetadata: sawStateSpace || /mamba|jamba|rwkv|zamba|hybrid/i.test(architecture),
      fileSizeBytes: stat.size,
      fileMtimeMs: stat.mtimeMs,
    }
  } catch {
    return null
  } finally {
    if (handle) await handle.close().catch(() => {})
  }
}

export function estimateKvCacheBytes(metadata, contextTokens) {
  const bytesPerToken = Number(metadata && metadata.bytesPerToken)
  const tokens = Number(contextTokens)
  if (!Number.isFinite(bytesPerToken) || bytesPerToken <= 0 || !Number.isFinite(tokens) || tokens <= 0) return null
  return Math.ceil(bytesPerToken * Math.floor(tokens))
}
