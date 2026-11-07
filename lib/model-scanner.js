import fs from 'node:fs/promises'
import path from 'node:path'

const isGguf = (filename) => /\.gguf$/i.test(filename)
const isProjector = (filename) => isGguf(filename) && /mmproj/i.test(path.basename(filename))
const isSkippableDirectoryError = (error) => ['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'].includes(error && error.code)

function groupLocalShards(files) {
  const ordinary = []
  const groups = new Map()
  for (const file of files) {
    const match = file.name.match(/^(.*?)-(\d{5})-of-(\d{5})\.gguf$/i)
    if (!match) {
      ordinary.push({ ...file, shardPaths: [file.path] })
      continue
    }
    const key = path.join(path.dirname(file.path), match[1])
    const total = Number(match[3])
    const group = groups.get(key) || { total, parts: [] }
    if (group.total === total) group.parts.push({ ...file, partNumber: Number(match[2]) })
    groups.set(key, group)
  }
  const incompleteShards = []
  for (const [key, group] of groups) {
    const parts = group.parts.sort((a, b) => a.partNumber - b.partNumber)
    if (parts.length !== group.total || parts.some((part, index) => part.partNumber !== index + 1)) {
      incompleteShards.push({ basePath: key, expectedParts: group.total, foundParts: parts.length })
      continue
    }
    const first = parts[0]
    ordinary.push({
      ...first,
      name: path.basename(key) + '.gguf',
      relativePath: first.relativePath,
      sizeBytes: parts.reduce((sum, part) => sum + part.sizeBytes, 0),
      shardCount: parts.length,
      shardPaths: parts.map((part) => part.path),
    })
  }
  return { files: ordinary, incompleteShards }
}

/**
 * Recursively find model GGUFs and their multimodal projectors.
 * Directory symlinks are intentionally not followed to prevent cycles and
 * scanning outside the selected root. A projector is only auto-associated when
 * its directory contains exactly one projector; ambiguous pairs stay explicit.
 */
export async function scanGgufDirectory(directoryPath) {
  const input = typeof directoryPath === 'string' ? directoryPath.trim() : ''
  if (!input) throw new Error('Укажи путь к папке для сканирования.')

  const root = path.resolve(input)
  const rootStat = await fs.stat(root)
  if (!rootStat.isDirectory()) throw new Error('Выбранный путь не является папкой.')

  const pending = [root]
  const visited = new Set()
  const rawModels = []
  const projectors = []
  let directoriesScanned = 0
  let skippedDirectories = 0
  let skippedFiles = 0
  const skippedDirectoryPaths = []

  while (pending.length) {
    const current = pending.pop()
    const normalized = process.platform === 'win32' ? current.toLowerCase() : current
    if (visited.has(normalized)) continue
    visited.add(normalized)

    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
      directoriesScanned += 1
    } catch (error) {
      if (current === root || !isSkippableDirectoryError(error)) throw error
      skippedDirectories += 1
      skippedDirectoryPaths.push(current)
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        // Active Hub bundle downloads are private staging areas, not model-library folders.
        // Do not surface a single completed component before the whole bundle is committed.
        if (entry.name.startsWith('.download-')) continue
        pending.push(fullPath)
        continue
      }
      // Dirent.isFile() deliberately skips linked files and linked folders.
      if (!entry.isFile() || !isGguf(entry.name)) continue

      try {
        const stat = await fs.stat(fullPath)
        if (!stat.isFile()) continue
        const record = {
          path: fullPath,
          name: entry.name,
          relativePath: path.relative(root, fullPath),
          sizeBytes: stat.size,
        }
        if (isProjector(entry.name)) projectors.push(record)
        else rawModels.push(record)
      } catch (error) {
        if (isSkippableDirectoryError(error)) {
          skippedFiles += 1
          continue
        }
        throw error
      }
    }
  }

  const grouped = groupLocalShards(rawModels)
  const projectorsByDirectory = new Map()
  for (const projector of projectors) {
    const directory = path.dirname(projector.path)
    const entries = projectorsByDirectory.get(directory) || []
    entries.push(projector)
    projectorsByDirectory.set(directory, entries)
  }
  const files = grouped.files.map((file) => {
    const sameDirectory = projectorsByDirectory.get(path.dirname(file.path)) || []
    return {
      ...file,
      mmprojPath: sameDirectory.length === 1 ? sameDirectory[0].path : '',
      mmprojCandidates: sameDirectory.map((entry) => ({ path: entry.path, name: entry.name, sizeBytes: entry.sizeBytes })),
    }
  })
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  projectors.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return {
    files,
    projectors,
    incompleteShards: grouped.incompleteShards,
    directoriesScanned,
    skippedDirectories,
    skippedFiles,
    skippedDirectoryPaths,
  }
}
