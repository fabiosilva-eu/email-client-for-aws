import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
const version = pkg.version || '0.1.0'
const releaseDir = path.resolve('release')

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true })
}

const sourceZipName = `Email_Client_for_AWS_S3_and_SES_${version}_source.zip`
const outputZipPath = path.join(releaseDir, sourceZipName)

if (fs.existsSync(outputZipPath)) {
  fs.unlinkSync(outputZipPath)
}

try {
  // Use git ls-files with --exclude-standard to strictly respect all .gitignore rules
  execSync(`git ls-files --cached --others --exclude-standard | zip -q -@ "${outputZipPath}"`, {
    stdio: 'inherit'
  })
  console.log(`[source-zip] Created source archive at: release/${sourceZipName} (100% .gitignore respected)`)
} catch (error) {
  try {
    // Fallback using git archive HEAD
    execSync(`git archive --format=zip --output="${outputZipPath}" HEAD`, { stdio: 'inherit' })
    console.log(`[source-zip] Created source archive at: release/${sourceZipName} via git archive`)
  } catch (fallbackError) {
    console.error('[source-zip] Failed to package source.zip:', fallbackError)
  }
}
