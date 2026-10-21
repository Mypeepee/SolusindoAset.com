import { NextRequest, NextResponse } from 'next/server';
import { CHATBOT_HEADERS as headers, chatbotError as fail, resolveChatbotAgent } from '@/lib/chatbot/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveChatbotAgent(); if (access instanceof NextResponse) return access;
    const { id } = await context.params;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return fail('INVALID_REQUEST', 400);
    const response = await fetch(`${access.base}/sandbox/${access.agentId}/documents/${id}`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      headers: { Authorization: `Bearer ${access.token}` } });
    if (!response.ok) return fail(response.status === 404 ? 'DOCUMENT_EXPIRED' : 'SERVICE_UNAVAILABLE', response.status === 404 ? 404 : 503);
    const disposition = response.headers.get('content-disposition') || '';
    if (response.headers.get('content-type')?.split(';')[0] !== 'application/pdf' ||
        !/^attachment; filename="Draf_MOU_Aset_[1-9]\d{0,17}\.pdf"$/.test(disposition)) return fail('INVALID_DOCUMENT', 503);
    const chunks: Uint8Array[] = []; let size = 0;
    if (!response.body) return fail('INVALID_DOCUMENT', 503);
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 4194304) { await reader.cancel(); return fail('INVALID_DOCUMENT', 503); } chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.subarray(0, 5).toString() !== '%PDF-') return fail('INVALID_DOCUMENT', 503);
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': disposition } });
  } catch { return fail('SERVICE_UNAVAILABLE', 503); }
}
