import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubStats } from '@/lib/github';
import { generateInsightCard } from '@/lib/card-generator';
import { getTheme } from '@/lib/themes';

function generateETag(content: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `"${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}"`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');
  const themeName = searchParams.get('theme') || 'satria';
  const showGraph = searchParams.get('graph') !== 'false';
  const showLanguages = searchParams.get('languages') !== 'false';
  const showStreak = searchParams.get('streak') !== 'false';
  const showStats = searchParams.get('stats') !== 'false';
  const showHeader = searchParams.get('header') !== 'false';
  const showSummary = searchParams.get('summary') !== 'false';
  const showProfile = searchParams.get('profile') !== 'false';
  const hideLangs = searchParams.get('hide_langs');
  const hiddenLanguages = hideLangs ? hideLangs.split(',').map(l => l.trim()).filter(Boolean) : [];

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (!username) {
    return new NextResponse(
      generateErrorCard('Username is required', getTheme('satria')),
      {
        status: 400,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders,
        },
      }
    );
  }

  const hasAtLeastOneTelemetry =
    showGraph ||
    showLanguages ||
    showStreak ||
    showStats ||
    showHeader ||
    showSummary ||
    showProfile;

  if (!hasAtLeastOneTelemetry) {
    return new NextResponse(
      generateErrorCard('At least one telemetry module must be enabled', getTheme(themeName)),
      {
        status: 400,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const stats = await fetchGitHubStats(username, hiddenLanguages);
    const theme = getTheme(themeName);
    
    const svg = generateInsightCard(stats, {
      theme,
      showGraph,
      showLanguages,
      showStreak,
      showStats,
      showHeader,
      showSummary,
      showProfile,
    });

    const etag = generateETag(svg);
    const ifNoneMatch = request.headers.get('if-none-match');

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
          ...corsHeaders,
        },
      });
    }

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error generating insight card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate stats';
    
    return new NextResponse(
      generateErrorCard(errorMessage, getTheme('satria')),
      {
        status: 500,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders,
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function generateErrorCard(message: string, theme: ReturnType<typeof getTheme>): string {
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 120);
  return `
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub Insights error" width="500" height="132" viewBox="0 0 500 132">
  <title>GitHub Insights error</title>
  <desc>${safeMessage}</desc>
  <rect x="0.5" y="0.5" width="499" height="131" rx="8" fill="${theme.background}" stroke="${theme.border}" stroke-width="1"/>
  <text x="250" y="52" text-anchor="middle" font-size="16" font-weight="700" fill="${theme.title}" font-family="Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" letter-spacing="-0.3">Request failed.</text>
  <rect x="219" y="64" width="62" height="2" rx="1" fill="#f85149"/>
  <text x="250" y="96" text-anchor="middle" font-size="11" font-weight="400" fill="${theme.textSecondary}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" letter-spacing="1">
    ${safeMessage}
  </text>
</svg>
  `.trim();
}