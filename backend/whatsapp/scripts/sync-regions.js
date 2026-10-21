// Same JSON files as /api/regions/wilayah. Read the pinned archive as data only;
// no extraction/execution. SQL exports have truncated names; don't use them.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const revision = process.argv[2] || 'b14111a0b2ef4b0d1eb850b3d59011a164090c2b';
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Supply a pinned Git commit (40 hex characters)');
const source = `https://codeload.github.com/ibnux/data-indonesia/tar.gz/${revision}`;
const response = process.argv[3] ? null : await fetch(source, { signal: AbortSignal.timeout(60000) });
if (response && !response.ok) throw new Error(`Region download failed: ${response.status}`);
const archive = process.argv[3] ? await readFile(process.argv[3]) : Buffer.from(await response.arrayBuffer());
const tar = gunzipSync(archive, { maxOutputLength: 256 * 1024 * 1024 });
const rows = [];
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  const name = header.subarray(0, 100).toString().replace(/\0.*$/, '').replace(/^[^/]+\//, '');
  const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
  if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid region archive');
  if (/^(?:propinsi\.json|kabupaten\/\d{2}\.json|kecamatan\/\d{4}\.json|kelurahan\/\d{6}\.json)$/.test(name)) {
    const data = JSON.parse(tar.subarray(offset + 512, offset + 512 + size).toString());
    if (!Array.isArray(data)) throw new Error(`Invalid region list: ${name}`);
    for (const r of data) {
      if (typeof r.id !== 'string' || typeof r.nama !== 'string') throw new Error(`Invalid region record: ${name}`);
      rows.push([r.id, r.nama.replace(/\s+/g, ' ').trim()]);
    }
  }
  offset += 512 + Math.ceil(size / 512) * 512;
}
const ids = new Set(rows.map(([id]) => id));
const parentLength = { 4: 2, 6: 4, 10: 6 };
const counts = { province: 0, city: 0, district: 0, village: 0 };
const levels = { 2: 'province', 4: 'city', 6: 'district', 10: 'village' };
for (const [id, name] of rows) {
  if (!levels[id.length] || !name || (id.length > 2 && !ids.has(id.slice(0, parentLength[id.length])))) throw new Error(`Invalid region or missing parent: ${id}`);
  counts[levels[id.length]]++;
}
if (ids.size !== rows.length || counts.province < 38 || counts.city < 500 || counts.district < 7000 || counts.village < 80000) throw new Error('Incomplete region export; previous snapshot retained');
rows.sort(([a], [b]) => a.localeCompare(b));
const snapshot = { source, revision, source_sha256: createHash('sha256').update(archive).digest('hex'), counts, rows };
const target = new URL('../data/regions.json', import.meta.url);
const temporary = new URL('../data/regions.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify(snapshot) + '\n');
await rename(temporary, target);
console.log(JSON.stringify({ counts, total: rows.length, revision }));
