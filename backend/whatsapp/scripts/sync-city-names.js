// Run from this repository after regenerating src/lib/lelang/wilayah.mjs.
// The output is bundled in standalone WhatsApp backend / Docker deployments.
import { writeFile } from 'node:fs/promises';
import { KOTA_KE_PROVINSI } from '../../../src/lib/lelang/wilayah.mjs';

await writeFile(new URL('../data/city-names.json', import.meta.url), JSON.stringify(Object.keys(KOTA_KE_PROVINSI).sort(), null, 2) + '\n');
