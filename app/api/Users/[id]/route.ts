import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://app.servicesuitecloud.com/WhatsappApi';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = params.id;

  // Forward the auth token from the incoming request
  const authHeader = request.headers.get('authorization') || '';

  // Try DELETE first; if the server returns 405, retry as POST with X-HTTP-Method-Override
  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const url = `${BACKEND_URL}/api/Users/${userId}`;

  try {
    // Attempt 1: standard DELETE
    let backendRes = await fetch(url, { method: 'DELETE', headers });

    // Attempt 2: if 405 Method Not Allowed, retry with POST + override header
    if (backendRes.status === 405) {
      console.log('DELETE blocked (405), retrying with POST + X-HTTP-Method-Override');
      backendRes = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'X-HTTP-Method-Override': 'DELETE' },
        body: JSON.stringify({}),
      });
    }

    // Attempt 3: if still 405, try POST to a /delete sub-path (common pattern)
    if (backendRes.status === 405) {
      console.log('Override also blocked, trying POST to /delete endpoint');
      backendRes = await fetch(`${BACKEND_URL}/api/Users/delete/${userId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: Number(userId) }),
      });
    }

    const text = await backendRes.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!backendRes.ok) {
      console.error(`Backend DELETE failed: ${backendRes.status}`, body);
      return NextResponse.json(
        { error: body?.error || body?.message || `Backend returned ${backendRes.status}`, details: body },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(body || { message: 'User deleted successfully' });
  } catch (error) {
    console.error('Proxy DELETE error:', error);
    return NextResponse.json({ error: 'Failed to reach backend' }, { status: 502 });
  }
}
