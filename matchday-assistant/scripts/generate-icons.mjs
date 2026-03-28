/**
 * Generates all PWA icon and splash screen PNGs from an SVG source.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ─── App icon SVG ─────────────────────────────────────────────────────────────
// Football on a dark-green rounded-square background
const iconSvg = (size) => {
  const pad = Math.round(size * 0.12);
  const ballCx = size / 2;
  const ballCy = size / 2;
  const ballR  = size * 0.34;
  const r      = Math.round(size * 0.22); // corner radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0f172a"/>
  <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${r - 4}" ry="${r - 4}" fill="#16a34a"/>
  <!-- Football circle -->
  <circle cx="${ballCx}" cy="${ballCy}" r="${ballR}" fill="white" stroke="#1e293b" stroke-width="${size * 0.018}"/>
  <!-- Pentagon patches (simplified hexagonal pattern) -->
  <polygon points="${pts(ballCx, ballCy, ballR * 0.28, 5, -90)}" fill="#1e293b"/>
  <polygon points="${pts(ballCx, ballCy - ballR * 0.55, ballR * 0.2, 5, -90)}" fill="#1e293b" opacity="0.9"/>
  <polygon points="${pts(ballCx + ballR * 0.52, ballCy + ballR * 0.17, ballR * 0.2, 5, 18)}" fill="#1e293b" opacity="0.9"/>
  <polygon points="${pts(ballCx - ballR * 0.52, ballCy + ballR * 0.17, ballR * 0.2, 5, -198)}" fill="#1e293b" opacity="0.9"/>
  <!-- Seam lines from centre patch to edge patches -->
</svg>`;
};

function pts(cx, cy, r, n, startDeg) {
  const step = (2 * Math.PI) / n;
  const start = (startDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const a = start + i * step;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

// ─── Splash screen SVG ────────────────────────────────────────────────────────
const splashSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0f172a"/>
  <!-- Icon centred -->
  <g transform="translate(${(w - 180) / 2}, ${(h - 180) / 2 - 30})">
    <rect width="180" height="180" rx="40" ry="40" fill="#16a34a"/>
    <circle cx="90" cy="90" r="61" fill="white" stroke="#1e293b" stroke-width="3"/>
    <polygon points="${pts(90, 90, 18, 5, -90)}" fill="#1e293b"/>
    <polygon points="${pts(90, 90 - 50, 14, 5, -90)}" fill="#1e293b" opacity="0.9"/>
    <polygon points="${pts(90 + 47, 90 + 15, 14, 5, 18)}" fill="#1e293b" opacity="0.9"/>
    <polygon points="${pts(90 - 47, 90 + 15, 14, 5, -198)}" fill="#1e293b" opacity="0.9"/>
  </g>
  <text x="${w / 2}" y="${h / 2 + 130}" font-family="system-ui, -apple-system, sans-serif"
    font-size="32" font-weight="700" fill="white" text-anchor="middle">Matchday Assistant</text>
  <text x="${w / 2}" y="${h / 2 + 170}" font-family="system-ui, -apple-system, sans-serif"
    font-size="18" fill="#94a3b8" text-anchor="middle">Livingston Community FC</text>
</svg>`;

// ─── Icon sizes ───────────────────────────────────────────────────────────────
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// ─── Apple splash screen sizes (portrait) ────────────────────────────────────
const splashSizes = [
  { w: 640,  h: 1136, name: 'apple-splash-640-1136'   },
  { w: 750,  h: 1334, name: 'apple-splash-750-1334'   },
  { w: 828,  h: 1792, name: 'apple-splash-828-1792'   },
  { w: 1080, h: 1920, name: 'apple-splash-1080-1920'  },
  { w: 1125, h: 2436, name: 'apple-splash-1125-2436'  },
  { w: 1170, h: 2532, name: 'apple-splash-1170-2532'  },
  { w: 1179, h: 2556, name: 'apple-splash-1179-2556'  },
  { w: 1242, h: 2688, name: 'apple-splash-1242-2688'  },
  { w: 1284, h: 2778, name: 'apple-splash-1284-2778'  },
  { w: 1290, h: 2796, name: 'apple-splash-1290-2796'  },
];

async function run() {
  // Icons
  console.log('Generating app icons...');
  for (const size of iconSizes) {
    const svg = Buffer.from(iconSvg(size));
    await sharp(svg)
      .png()
      .toFile(join(OUT, `icon-${size}x${size}.png`));
    process.stdout.write(`  ✓ icon-${size}x${size}.png\n`);
  }

  // Splash screens
  console.log('\nGenerating splash screens...');
  for (const { w, h, name } of splashSizes) {
    const svg = Buffer.from(splashSvg(w, h));
    await sharp(svg)
      .png()
      .toFile(join(OUT, `${name}.png`));
    process.stdout.write(`  ✓ ${name}.png\n`);
  }

  // Also write maskable variants (icon with extra padding)
  console.log('\nGenerating maskable icons...');
  for (const size of [192, 512]) {
    // Re-render with more padding for safe zone (80% content area)
    const svgMask = (s) => {
      const pad = Math.round(s * 0.2);
      const ballCx = s / 2;
      const ballCy = s / 2;
      const ballR  = s * 0.28;
      const r = Math.round(s * 0.04);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="#16a34a"/>
  <circle cx="${ballCx}" cy="${ballCy}" r="${ballR}" fill="white" stroke="#1e293b" stroke-width="${s * 0.015}"/>
  <polygon points="${pts(ballCx, ballCy, ballR * 0.28, 5, -90)}" fill="#1e293b"/>
  <polygon points="${pts(ballCx, ballCy - ballR * 0.55, ballR * 0.2, 5, -90)}" fill="#1e293b" opacity="0.9"/>
  <polygon points="${pts(ballCx + ballR * 0.52, ballCy + ballR * 0.17, ballR * 0.2, 5, 18)}" fill="#1e293b" opacity="0.9"/>
  <polygon points="${pts(ballCx - ballR * 0.52, ballCy + ballR * 0.17, ballR * 0.2, 5, -198)}" fill="#1e293b" opacity="0.9"/>
</svg>`;
    };
    const svg = Buffer.from(svgMask(size));
    await sharp(svg)
      .png()
      .toFile(join(OUT, `icon-maskable-${size}x${size}.png`));
    process.stdout.write(`  ✓ icon-maskable-${size}x${size}.png\n`);
  }

  console.log('\nDone! All icons written to public/icons/');
}

run().catch(err => { console.error(err); process.exit(1); });
