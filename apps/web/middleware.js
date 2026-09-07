import { NextResponse } from 'next/server';

// UX-only guard - the cookie's mere presence just avoids a flash of a page
// that will 401 anyway. Every API call still verifies the token server-side.
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith('/admin/clients');

  if (isProtected && !request.cookies.has('admin_token')) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/clients/:path*'],
};
