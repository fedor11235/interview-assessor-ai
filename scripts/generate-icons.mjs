import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const png2icons = require('png2icons')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = resolve(root, 'assets/app-icon.svg')
const buildDir = resolve(root, 'build')
const svg = readFileSync(svgPath)

mkdirSync(buildDir, { recursive: true })

const sourcePng = await sharp(svg)
  .resize(1024, 1024, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toBuffer()

writeFileSync(resolve(buildDir, 'icon.png'), sourcePng)

for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
  const png = await sharp(svg)
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer()

  writeFileSync(resolve(buildDir, `icon-${size}.png`), png)
}

const icns = png2icons.createICNS(sourcePng, png2icons.BICUBIC2, 0)
const ico = png2icons.createICO(sourcePng, png2icons.BICUBIC2, 0, false, true)

if (!icns || !ico) {
  throw new Error('Failed to generate platform icon files.')
}

writeFileSync(resolve(buildDir, 'icon.icns'), icns)
writeFileSync(resolve(buildDir, 'icon.ico'), ico)

console.log('Generated app icons in build/.')

