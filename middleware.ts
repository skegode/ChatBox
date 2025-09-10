// Middleware for protecting dashboard routes
// middleware.ts
import { NextResponse } from 'next/server';

// Removing the middleware for now since we're using client-side auth
export function middleware(request: Request) {
  return NextResponse.next();
}

export const config = { matcher: '/dashboard/:path*' };