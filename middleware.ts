// Middleware for protecting dashboard routes
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// Removing the middleware for now since we're using client-side auth
export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  // Normalize malformed reset links like /password-reset/password-reset?... to /password-reset?...
  if (nextUrl.pathname === '/password-reset/password-reset') {
    const redirectUrl = nextUrl.clone();
    redirectUrl.pathname = '/password-reset';
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/password-reset/password-reset'] };