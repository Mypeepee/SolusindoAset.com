// npm run pindai:tol -- --limit=100 --batch=10
// Melengkapi cache lama yang titiknya jelas; permintaan peta dibagi per batch.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const arg = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = arg("base", "http://localhost:3000").replace(/\/+$/, "");
const limit = Math.max(1, Math.min(Number(arg("limit", "100")) || 100, 1000));
const batch = Math.max(1, Math.min(Number(arg("batch", "10")) || 10, 10));
try {
  const [row] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM listing_sekitar s
    WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
      AND NOT (s.latitude = 0 AND s.longitude = 0)
      AND (s.presisi_titik IN ('TITIK','ALAMAT','KELURAHAN','KECAMATAN')
           OR (s.presisi_titik IS NULL AND s.sumber_titik = 'LISTING'))
  `;
  const total = Math.min(limit, Number(row.n));
  console.log(`Melengkapi pintu tol untuk ${total} cache aset.`);
  for (let offset = 0; offset < total; offset += batch) {
    const response = await fetch(`${base}/api/tempat/serap`, {
      method: "POST", signal: AbortSignal.timeout(65_000),
      headers: { "Content-Type": "application/json", ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}) },
      body: JSON.stringify({ mode: "pintu-tol", offset, limit: Math.min(batch, total - offset) }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? `HTTP ${response.status}`);
    console.log(`${Math.min(offset + batch, total)}/${total}: ${result.gerbang} gerbang, ${result.relasi} relasi aset.`);
    if (offset + batch < total) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
