import { NextResponse, NextRequest } from 'next/server';

// Lightweight stub proxy route. The full proxy was removed; keep a small
// handler so Next's type generation doesn't fail during build. This returns
// 501 to indicate the proxy isn't configured in this environment.
async function handler(req: NextRequest) {
	return NextResponse.json({ error: 'Proxy not configured' }, { status: 501 });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };
