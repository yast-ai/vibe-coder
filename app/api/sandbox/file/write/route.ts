import { NextRequest, NextResponse } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    console.log('[write/route.ts] POST request received');
    const { sandboxId, path, content } = await request.json();
    console.log(`[write/route.ts] Request body parsed: sandboxId=${sandboxId}, path=${path}, contentLength=${(content as string)?.length || 0}`);

    if (!sandboxId || !path || content === undefined) {
      console.log('[write/route.ts] Validation failed: missing required fields');
      return NextResponse.json(
        { error: 'Missing sandboxId, path, or content' },
        { status: 400 }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      console.log(`[write/route.ts] Sandbox not found: ${sandboxId}`);
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Ensure directory exists
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    if (dirPath) {
      console.log(`[write/route.ts] Creating directory: ${dirPath}`);
      try {
        await sandbox.mkDir(dirPath);
      } catch (error) {
        console.log(`[write/route.ts] Directory may already exist or cannot be created: ${dirPath}`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log(`[write/route.ts] Writing file: ${path} (${(content as string).length} bytes)`);
    await sandbox.writeFiles([{ path, content: Buffer.from(content as string) }]);
    console.log(`[write/route.ts] File written successfully: ${path}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[write/route.ts] Error writing file:', error);
    return NextResponse.json(
      { error: 'Failed to write file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

