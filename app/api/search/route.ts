import { NextRequest, NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import path from 'path';
import { invokeClaudeCode } from '@/lib/claude';

const AGENCIES_DIR = path.join(process.cwd(), 'data/agencies');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suburb } = body;

    if (!suburb || typeof suburb !== 'string') {
      return NextResponse.json({ success: false, error: 'Suburb required' }, { status: 400 });
    }

    const slug = slugify(suburb);
    const cacheFile = path.join(AGENCIES_DIR, `${slug}.json`);

    // Check cache first
    try {
      const cached = await readFile(cacheFile, 'utf-8');
      const data = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(data.searchedAt).getTime();

      // Return cache if less than 24 hours old
      if (cacheAge < 24 * 60 * 60 * 1000) {
        console.log(`[Search] Returning cached results for ${suburb}`);
        return NextResponse.json({ success: true, ...data, cached: true });
      }
    } catch {
      // No cache
    }

    console.log(`[Search] Invoking Claude Code for suburb: ${suburb}`);

    // Invoke Claude Code with agency-researcher skill
    const prompt = `
Use the agency-researcher skill to find and analyze real estate agencies in "${suburb}".

Absolute output path: ${cacheFile}

Instructions:
1. Search for real estate agencies in ${suburb}
2. Visit each agency's website to extract details
3. Calculate pain scores based on the criteria in the skill
4. Save results to: ${cacheFile}
5. Return a JSON summary of the agencies found

Output format:
{
  "suburb": "${suburb}",
  "searchedAt": "<ISO timestamp>",
  "totalFound": <number>,
  "agencies": [...]
}
`;

    try {
      await invokeClaudeCode({ prompt, workingDir: process.cwd() });
    } catch (error) {
      console.error('[Search] Claude Code error:', error);
      // Continue - results may have been saved to file
    }

    // Read results from file
    await mkdir(AGENCIES_DIR, { recursive: true });

    try {
      const results = await readFile(cacheFile, 'utf-8');
      const data = JSON.parse(results);
      return NextResponse.json({ success: true, ...data });
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Search failed - results not saved'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
