import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPropertyKnowledge } from '@/lib/chatbot/property-knowledge';
import { docxToPdf } from '@/lib/server/docxToPdf';
import { renderMouDraft } from '@/lib/server/chatbotMouDraft.mjs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
let pending = 0;

export async function POST(request: NextRequest) {
  const secret = process.env.CHATBOT_PROPERTY_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  if (pending >= 2) return NextResponse.json({ error: 'MOU_PDF_BUSY' }, { status: 503, headers });
  pending += 1;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new SyntaxError();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 1024) { await reader.cancel(); return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413, headers }); } chunks.push(value); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || Object.keys(input).some((key) => !['assetId', 'maxBid'].includes(key)) ||
      typeof input.assetId !== 'string' || !/^[1-9]\d{0,17}$/.test(input.assetId) ||
      input.maxBid != null && (!Number.isSafeInteger(input.maxBid) || input.maxBid <= 0 || input.maxBid > 1e15)) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400, headers });
    }
    // Re-read the same public listing projection as the chatbot. The caller
    // cannot supply a price, address, client identity, bank account or template.
    const context = await getPropertyKnowledge(prisma, { text: `Kode ${input.assetId}`, previousId: null });
    if (!context.asset || context.asset.id !== input.assetId || context.asset.transaction_type !== 'LELANG') {
      return NextResponse.json({ error: 'MOU_ASSET_UNAVAILABLE' }, { status: 404, headers });
    }
    const file = await renderMouDraft(context.asset, { maxBid: input.maxBid || null,
      templatePath: join(process.cwd(), 'src/app/dashboard/surat/components/templates/MOU_Template_persentase_final.docx'),
      convertDocx: (buffer: Buffer) => docxToPdf(buffer, 'chatbot-mou-draft') });
    return new NextResponse(new Uint8Array(file.buffer), { headers: { ...headers, 'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`, 'X-MOU-Asset-ID': file.assetId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'INVALID_REQUEST' : 'MOU_PDF_UNAVAILABLE' },
      { status: error instanceof SyntaxError ? 400 : 503, headers });
  } finally { pending -= 1; }
}
