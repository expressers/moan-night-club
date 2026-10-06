// Prepara as fotografias enviadas pela casa para a web (webp + jpg).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = 'public/img';
mkdirSync(out, { recursive: true });

const jobs = [
  { src: '_raw/moan-01.jpg', name: 'fachada-noite', w: 1600 },
  { src: '_raw/moan-02.jpg', name: 'salao', w: 1200 },
  { src: '_raw/moan-03.jpg', name: 'noite-cubana', w: 1024 },
  // A foto real da fachada tem barras cinzentas e marca d'agua em baixo: recorta.
  { src: '_raw/moan-04.jpg', name: 'fachada-rua', w: 828, crop: { left: 0, top: 112, width: 828, height: 1250 } },
];

for (const j of jobs) {
  let img = sharp(j.src);
  if (j.crop) img = img.extract(j.crop);
  img = img.resize({ width: j.w, withoutEnlargement: true });
  await img.clone().webp({ quality: 82 }).toFile(`${out}/${j.name}.webp`);
  await img.clone().jpeg({ quality: 84, mozjpeg: true }).toFile(`${out}/${j.name}.jpg`);
  console.log('ok', j.name);
}

await sharp('_raw/moan-01.jpg').resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 84 }).toFile(`${out}/og.jpg`);
console.log('ok og');
