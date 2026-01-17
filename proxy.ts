import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Prevent bypassing the `/demo/[slug]` and `/call/[id]` routes (which inject
  // the required demo-call script) via direct access to static `.html` files in
  // `/public`.
  if (pathname.startsWith('/demo/') && pathname.endsWith('.html')) {
    const slug = pathname.slice('/demo/'.length, -'.html'.length);
    const url = request.nextUrl.clone();
    url.pathname = `/demo/${slug}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/call/') && pathname.endsWith('.html')) {
    const id = pathname.slice('/call/'.length, -'.html'.length);
    const url = request.nextUrl.clone();
    url.pathname = `/call/${id}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/demo/:path*', '/call/:path*'],
};
