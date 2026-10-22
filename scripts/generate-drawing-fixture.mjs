import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Original, inert vector drawing for research. PDF points, origin bottom left.
const destination = resolve(process.argv[2] || '.local/drawing-fixture');
const variant = process.argv[3] || 'base';
if (!['base', 'revision'].includes(variant)) throw new RangeError('Variant must be base or revision');
const symbols = variant === 'base'
  ? [[100, 100], [200, 100], [300, 100], [100, 200], [200, 200], [300, 200]]
  : [[200, 100], [300, 100], [100, 200], [200, 200], [300, 200], [350, 150]];
const content = [
  '0 0 0 RG 1 w',
  'BT /F1 16 Tf 50 790 Td (Fire Take Off - original synthetic fixture) Tj ET',
  'BT /F1 10 Tf 50 770 Td (Research only - no construction or compliance use) Tj ET',
  ...symbols.map(([x,y]) => `${x-5} ${y-5} 10 10 re S ${x-7} ${y} m ${x+7} ${y} l S ${x} ${y-7} m ${x} ${y+7} l S`),
  '50 400 m 350 400 l 350 600 l S',
  '50 450 100 100 re S',
  '0.5 G 50 50 350 200 re S',
].join('\n') + '\n';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const manifest = {
  schema: 1, provenance: 'Original Fire Take Off synthetic geometry; no reference assets',
  variant, file: 'small-vector.pdf', sha256: createHash('sha256').update(pdf).digest('hex'),
  page: { width: 595, height: 842, units: 'PDF points', origin: 'bottom-left' },
  symbols: symbols.map(([x,y], index) => ({ id: `symbol-${index+1}`, family: 'square-cross', x, y })),
  calibration: { from: [50,400], to: [350,400], knownLengthMetres: 30 },
  polyline: { points: [[50,400],[350,400],[350,600]], expectedMetres: 50 },
  area: { points: [[50,450],[150,450],[150,550],[50,550]], expectedSquareMetres: 100 },
  zone: { bounds: [50,50,400,250], expectedSymbolCount: 6 },
  revisionChanges: variant === 'revision' ? { removedCentres: [[100,100]], addedCentres: [[350,150]], unchangedCount: 5 } : null,
  limitations: ['Single page, vector only', 'No trade-specific recognition claim', 'No benchmark budget accepted', 'No renderer or product tested'],
};
await mkdir(destination, { recursive: true });
await writeFile(resolve(destination, manifest.file), pdf);
await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ destination, sha256: manifest.sha256, bytes: Buffer.byteLength(pdf) }));
