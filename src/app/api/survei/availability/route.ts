import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { surveyAvailability, SurveyBookingError } from '@/lib/chatbot/survey-booking';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId'), date = req.nextUrl.searchParams.get('date');
    if (!agentId || !date) return NextResponse.json({ error: 'agentId and date required' }, { status: 400 });
    return NextResponse.json(await surveyAvailability(prisma, agentId, date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SurveyBookingError ? error.code : 'SURVEY_UNAVAILABLE' }, { status: error instanceof SurveyBookingError ? error.status : 503 });
  }
}
