import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { access } from 'fs/promises';
import { invokeClaudeCode } from '@/lib/claude';

const AGENCIES_DIR = path.join(process.cwd(), 'data/agencies');
const DEMO_DIR = path.join(process.cwd(), 'public/demo');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agencyId } = body;

    if (!agencyId || typeof agencyId !== 'string') {
      return NextResponse.json({ success: false, error: 'agencyId required' }, { status: 400 });
    }

    // Check if demo page already exists
    const demoFile = path.join(DEMO_DIR, `${agencyId}.html`);
    try {
      await access(demoFile);
      console.log(`[Generate Demo] Page already exists for ${agencyId}`);
      return NextResponse.json({
        success: true,
        url: `/demo/${agencyId}`,
        cached: true
      });
    } catch {
      // Page doesn't exist
    }

    // Find agency data
    let agencyData = null;
    const files = await readdir(AGENCIES_DIR);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = JSON.parse(
        await readFile(path.join(AGENCIES_DIR, file), 'utf-8')
      );

      // Check if it's a search results file
      if (content.agencies) {
        const found = content.agencies.find((a: { id: string }) => a.id === agencyId);
        if (found) {
          agencyData = found;
          break;
        }
      }

      // Check if it's an individual agency file
      if (content.id === agencyId) {
        agencyData = content;
        break;
      }
    }

    if (!agencyData) {
      return NextResponse.json({ success: false, error: 'Agency not found' }, { status: 404 });
    }

    console.log(`[Generate Demo] Invoking Claude Code for ${agencyId}`);

    const prompt = `
Use the demo-page-builder skill to generate a branded demo landing page for this agency.

Agency Data:
${JSON.stringify(agencyData, null, 2)}

Demo HTML Path (absolute): ${demoFile}

Instructions:
1. Generate a creative, branded HTML landing page
2. Use the agency's colors and logo
3. Highlight their pain points and how Voqo helps
4. Include ROI calculator section
5. Include "Call Demo" button that registers call context
6. Add a "Recent Calls" section that fetches /api/agency-calls?agency=${agencyId}
   - Render call list with callerName (if present), summary, and link to pageUrl (/call/<id>)
   - If no calls, show a friendly empty state
7. Save to: ${demoFile}
8. The page should call /api/register-call when user clicks Call Demo

Make the page visually impressive - this is a sales demo.
`;

    try {
      await invokeClaudeCode({ prompt, workingDir: process.cwd() });
    } catch (error) {
      console.error('[Generate Demo] Claude Code error:', error);
    }

    // Check if page was generated
    try {
      await access(demoFile);
      return NextResponse.json({
        success: true,
        url: `/demo/${agencyId}`
      });
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Page generation failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Generate Demo] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
