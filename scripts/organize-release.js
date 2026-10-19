import fs from 'node:fs'
import path from 'node:path'

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
const version = pkg.version || '0.1.0'
const releaseDir = path.resolve('release')
const versionDir = path.join(releaseDir, version)

if (!fs.existsSync(releaseDir)) {
  console.log('[organize] No release directory found.')
  process.exit(0)
}

if (!fs.existsSync(versionDir)) {
  fs.mkdirSync(versionDir, { recursive: true })
}

// Distribution file extensions that end users download
const DIST_EXTENSIONS = ['.dmg', '.zip', '.exe', '.appimage', '.deb', '.tar.gz', '.gz']
// Excluded extensions or files
const IGNORED_SUFFIXES = ['.blockmap', '.yml', '.yaml', '.7z']

const files = fs.readdirSync(releaseDir)
let movedCount = 0

for (const file of files) {
  const fullPath = path.join(releaseDir, file)
  const stat = fs.statSync(fullPath)

  // Skip subdirectories (like 0.1.0 or unpacked dirs)
  if (stat.isDirectory()) continue

  const lowerName = file.toLowerCase()

  // Skip blockmaps and debug metadata
  if (IGNORED_SUFFIXES.some((suffix) => lowerName.endsWith(suffix))) {
    continue
  }

  // Check if it matches a valid distribution extension
  const isDistFile = DIST_EXTENSIONS.some((ext) => lowerName.endsWith(ext))

  if (isDistFile) {
    const destPath = path.join(versionDir, file)
    fs.renameSync(fullPath, destPath)
    console.log(`  ✓ Moved to release/${version}/: ${file}`)
    movedCount++
  }
}

console.log(`\n🎉 Successfully organized ${movedCount} distribution files into release/${version}/`)

