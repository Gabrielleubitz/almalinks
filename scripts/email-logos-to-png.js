/**
 * Convert email logo SVGs to PNG for Gmail/Outlook compatibility.
 * Run: npm run build:email-logos  (or node scripts/email-logos-to-png.js)
 * Output: public/logo.png, public/igani-logo-placeholder.png
 *
 * Alma logo: uses public/logo.svg if present, else src/assets/alma-links-logo.svg.
 * Emails must use logo.png (Gmail/Outlook block SVG). Commit public/logo.png after running.
 */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const srcDir = path.join(__dirname, '..', 'src');

// Alma logo: prefer public/logo.svg, fallback to src/assets/alma-links-logo.svg
const logoInPath = existsSync(path.join(publicDir, 'logo.svg'))
  ? path.join(publicDir, 'logo.svg')
  : path.join(srcDir, 'assets', 'alma-links-logo.svg');

const conversions = [
  { inPath: logoInPath, out: path.join(publicDir, 'logo.png'), width: 400 },
  { inPath: path.join(publicDir, 'igani-logo-placeholder.svg'), out: path.join(publicDir, 'igani-logo-placeholder.png'), width: 160 },
];

for (const { inPath, out, width } of conversions) {
  try {
    if (!existsSync(inPath)) {
      console.warn('Skip (missing):', inPath);
      continue;
    }
    const svg = readFileSync(inPath);
    await sharp(svg)
      .resize(width)
      .png()
      .toFile(out);
    console.log('Created', path.basename(out));
  } catch (e) {
    console.error('Failed', inPath, '->', out, e.message);
  }
}
