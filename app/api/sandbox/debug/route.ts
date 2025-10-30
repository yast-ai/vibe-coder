import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers),
    requestUrl: request.url,
    method: request.method,
    cssPolicyHeaders: {
      'Content-Security-Policy': request.headers.get('content-security-policy'),
      'Cross-Origin-Resource-Policy': request.headers.get('cross-origin-resource-policy'),
      'Access-Control-Allow-Origin': request.headers.get('access-control-allow-origin'),
      'X-Frame-Options': request.headers.get('x-frame-options'),
    },
    responseHeaders: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Frame-Options': 'ALLOWALL',
    },
  };

  const response = NextResponse.json(debugInfo);
  response.headers.set('Content-Type', 'application/json');
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  response.headers.set('X-Frame-Options', 'ALLOWALL');

  return response;
}

export async function POST(request: Request) {
  const body = await request.json();
  
  return NextResponse.json({
    message: 'Debug endpoint working',
    receivedData: body,
    serverHeaders: {
      cssPolicyConfigured: true,
      corsEnabled: true,
      iframeEmbeddingAllowed: true,
    },
  });
}
