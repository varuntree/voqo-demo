import { NextRequest, NextResponse } from 'next/server';
import { getAgencyCalls } from '@/lib/agency-calls';

export async function GET(request: NextRequest) {
  try {
    const agencyId = request.nextUrl.searchParams.get('agency');

    if (!agencyId) {
      return NextResponse.json({ agencyId: null, calls: [] });
    }

    const data = await getAgencyCalls(agencyId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Agency Calls] Error:', error);
    return NextResponse.json({ agencyId: null, calls: [] }, { status: 500 });
  }
}
