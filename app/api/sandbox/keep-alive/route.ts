import { NextRequest, NextResponse } from 'next/server';
import { getSandbox, hasSandbox } from '@/lib/sandbox-manager';

/**
 * Keep-alive endpoint to maintain function instance warmth
 * Client should call this periodically to prevent instance recycling
 * Helps keep sandbox references in memory across requests
 */
export async function POST(request: NextRequest) {
  try {
    const { sandboxId } = await request.json();

    if (!sandboxId) {
      return NextResponse.json(
        { error: 'Missing sandboxId' },
        { status: 400 }
      );
    }

    // Check if sandbox exists in this instance
    const exists = hasSandbox(sandboxId);
    const sandbox = getSandbox(sandboxId);

    console.log(`[keep-alive] Heartbeat for sandbox ${sandboxId}: exists=${exists}, cached=${!!sandbox}`);

    return NextResponse.json({
      sandboxId,
      exists,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[keep-alive] Error:', error);
    return NextResponse.json(
      { error: 'Keep-alive failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
