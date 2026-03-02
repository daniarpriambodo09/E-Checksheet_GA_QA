// middleware.ts (di root folder, BUKAN di app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Public routes that don't need auth
  const publicRoutes = ['/login-page', '/signup-page'];
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check auth from cookies (NOT localStorage - middleware can't access localStorage)
  const sessionToken = request.cookies.get('auth_session_token')?.value;
  
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login-page', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};