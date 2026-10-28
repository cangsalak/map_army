import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that unauthenticated users can access
const PUBLIC_PATHS = ['/login', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, internal files, and APIs (APIs have their own Express/Next guards)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/cesium') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Check for token in cookie or Authorization header
  const token =
    request.cookies.get('geomonitor_token')?.value ||
    request.cookies.get('geomonitor_access_token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  const isPublicRoute = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // 3. Unauthenticated access to protected route -> Redirect to /login
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated access to login page -> Redirect to dashboard (/)
  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 5. Otherwise continue
  const response = NextResponse.next();
  response.headers.set('x-geomonitor-authenticated', token ? 'true' : 'false');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
