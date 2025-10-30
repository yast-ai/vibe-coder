import { NextRequest, NextResponse } from 'next/server';
import { getSandbox, getSandboxStatus } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    console.log('[health/route.ts] Health check request received');
    const { sandboxId } = await request.json();
    console.log(`[health/route.ts] Checking health for sandbox: ${sandboxId}`);

    if (!sandboxId) {
      console.log('[health/route.ts] Validation failed: missing sandboxId');
      return NextResponse.json(
        { error: 'Missing sandboxId' },
        { status: 400 }
      );
    }

    const status = getSandboxStatus(sandboxId);
    console.log(`[health/route.ts] Sandbox status from memory:`, status);
    
    if (!status) {
      console.log(`[health/route.ts] Sandbox not found: ${sandboxId}`);
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    let isAccessible = false;
    let accessError = '';

    // If sandbox is marked as ready, verify the dev server is actually accessible
    if (status.isReady) {
      console.log(`[health/route.ts] Sandbox is marked as ready, checking server accessibility`);
        const sandbox = getSandbox(sandboxId);
        if (!sandbox) {
          console.log(`[health/route.ts] Sandbox not found: ${sandboxId}`);
          return NextResponse.json(
            { error: 'Sandbox not found' },
            { status: 404 }
          );
        }
          const previewUrl = sandbox.domain(3000);
          console.log(`[health/route.ts] Preview URL: ${previewUrl}`);
          
          // Try to fetch from the preview URL with a short timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

            console.log(`[health/route.ts] Fetching preview URL...`);
            const response = await fetch(previewUrl, {
              signal: controller.signal,
              method: 'GET',
            });
            
            clearTimeout(timeoutId);
            console.log(`[health/route.ts] Got response status: ${response.status}`);
            
            // Any 2xx or 3xx status means the server is responding
            if (response.status < 400) {
              isAccessible = true;
              console.log(`[health/route.ts] Server is accessible`);
            } else {
              accessError = `Server returned status ${response.status}`;
              console.log(`[health/route.ts] Server returned error status: ${response.status}`);
            }
          }

    return NextResponse.json({
      isReady: status.isReady,
      isAccessible,
      error: status.error || null,
      accessError: accessError || null,
    });
  } catch (error) {
    console.error('[health/route.ts] Error checking sandbox health:', error);
    return NextResponse.json(
      { error: 'Failed to check sandbox health', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

