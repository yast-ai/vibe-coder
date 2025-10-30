import { NextRequest, NextResponse } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    console.log('[read/route.ts] POST request received');
    const { sandboxId, path } = await request.json();
    console.log(`[read/route.ts] Request body parsed: sandboxId=${sandboxId}, path=${path}`);

    if (!sandboxId || !path) {
      console.log('[read/route.ts] Validation failed: missing sandboxId or path');
      return NextResponse.json(
        { error: 'Missing sandboxId or path' },
        { status: 400 }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      console.log(`[read/route.ts] Sandbox not found: ${sandboxId}`);
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    console.log(`[read/route.ts] Reading file: ${path} from sandbox ${sandboxId}`);

    // Handle both relative and absolute paths
    // If path is relative, assume it's relative to /vercel/sandbox
    const fullPath = path.startsWith('/') ? path : `/vercel/sandbox/${path}`;
    console.log(`[read/route.ts] Full path: ${fullPath}`);

    // readFile returns a ReadableStream or null
    console.log(`[read/route.ts] Calling sandbox.readFile({ path: '${fullPath}' })`);
    const stream = await sandbox.readFile({ path: fullPath });
    console.log(`[read/route.ts] sandbox.readFile returned:`, stream ? 'stream' : 'null');
    
    if (!stream) {
      console.error(`[read/route.ts] File not found: ${fullPath}`);
      return NextResponse.json(
        { error: 'File not found', path: fullPath },
        { status: 404 }
      );
    }

    // Convert stream to string
    console.log(`[read/route.ts] Converting stream to string`);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    console.log(`[read/route.ts] Successfully read file: ${fullPath} (${content.length} bytes)`);

    return NextResponse.json({ content });
  } catch (error) {
    console.error('[read/route.ts] Error reading file:', error);
    return NextResponse.json(
      { error: 'Failed to read file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

