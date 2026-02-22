/**
 * Convert email logo SVGs to PNG for Gmail/Outlook compatibility.
 * Run: node scripts/email-logos-to-png.js
 * Output: public/logo.png, public/igani-logo-placeholder.png
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const conversions = [
  { in: 'logo.svg', out: 'logo.png', width: 400 },
  { in: 'igani-logo-placeholder.svg', out: 'igani-logo-placeholder.png', width: 160 },
];

for (const { in: nameIn, out: nameOut, width } of conversions) {
  const inputPath = path.join(publicDir, nameIn);
  const outputPath = path.join(publicDir, nameOut);
  try {
    const svg = readFileSync(inputPath);
    await sharp(svg)
      .resize(width)
      .png()
      .toFile(outputPath);
    console.log('Created', nameOut);
  } catch (e) {
    console.error('Failed', nameIn, '->', nameOut, e.message);
  }
}
