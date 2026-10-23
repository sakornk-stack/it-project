import { NextResponse, type NextRequest } from 'next/server';

// Docker Desktop's port links open http://127.0.0.1:3000, but the backend's
// CORS_ORIGIN and the API URL baked into the bundle both use localhost.
// Browsers treat the two as different sites, so every API call is blocked
// by CORS and the SameSite=Lax refresh cookie would never be sent. Moving
// the browser onto localhost (same port, path and query) fixes both. Never
// matches in production, where the host is a real domain.
//
// Reads the Host header rather than request.nextUrl: the standalone server
// in Docker builds nextUrl from its bind address (HOSTNAME=0.0.0.0), not
// from what the browser asked for.
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const [hostname, port] = host.split(':');
  if (hostname !== '127.0.0.1') {
    return NextResponse.next();
  }
  const { pathname, search } = request.nextUrl;
  const target = `http://localhost${port ? `:${port}` : ''}${pathname}${search}`;
  return NextResponse.redirect(target);
}

export const config = {
  matcher: '/((?!_next/|favicon.ico).*)',
};
