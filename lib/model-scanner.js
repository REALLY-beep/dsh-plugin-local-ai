import fs from 'node:fs/promises'
import path from 'node:path'

const isGgufModel = (filename) => /\.gguf$/i.test(filename) && !/mmproj/i.test(filename)
const isSkippableDirectoryError = (error) => ['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'].includes(error && error.code)

/**
 * Recursively find GGUF model files under a directory.
 *
 * Directory symlinks are intentionally not followed: they can create cycles or
 * unexpectedly send a scan outside the selected folder. A symlink passed as
 * the root itself is allowed because the root is resolved with stat().
 * Unreadable child folders are skipped and reported in the result.
 */
export async function scanGgufDirectory(directoryPath) {
  const input = typeof directoryPath === 'string' ? directoryPath.trim() : ''
  if (!input) throw new Error('Укажи путь к папке для сканирования.')

  const root = path.resolve(input)
  const rootStat = await fs.stat(root)
  if (!rootStat.isDirectory()) throw new Error('Выбранный путь не является папкой.')

  const pending = [root]
  const visited = new Set()
  const files = []
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
        pending.push(fullPath)
        continue
      }

      // Dirent.isFile() is false for symbolic links, so linked files/folders
      // are deliberately not followed during a recursive scan.
      if (!entry.isFile() || !isGgufModel(entry.name)) continue

      try {
        const stat = await fs.stat(fullPath)
        if (!stat.isFile()) continue
        files.push({
          path: fullPath,
          name: entry.name,
          relativePath: path.relative(root, fullPath),
          sizeBytes: stat.size,
        })
      } catch (error) {
        if (isSkippableDirectoryError(error)) {
          skippedFiles += 1
          continue
        }
        throw error
      }
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return { files, directoriesScanned, skippedDirectories, skippedFiles, skippedDirectoryPaths }
}
