import { NextRequest, NextResponse } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    console.log('[command/route.ts] POST request received');
    const { sandboxId, command } = await request.json();
    console.log(`[command/route.ts] Request body parsed: sandboxId=${sandboxId}, command=${command}`);

    if (!sandboxId || !command) {
      console.log('[command/route.ts] Validation failed: missing sandboxId or command');
      return NextResponse.json(
        { error: 'Missing sandboxId or command' },
        { status: 400 }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      console.log(`[command/route.ts] Sandbox not found: ${sandboxId}`);
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    console.log(`[command/route.ts] Executing command in sandbox ${sandboxId}: ${command}`);

    try {
      // Parse command string into cmd and args
      const parts = command.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      console.log(`[command/route.ts] Parsed command: cmd=${cmd}, args=[${args.join(', ')}]`);

      // Execute command with proper format
      console.log(`[command/route.ts] Running sandbox.runCommand`);
      const result = await sandbox.runCommand({
        cmd,
        args,
      });
      console.log(`[command/route.ts] Command completed with exitCode=${result.exitCode}`);
      
      // Get stdout and stderr separately
      console.log(`[command/route.ts] Getting stdout`);
      const stdout = await result.stdout();
      console.log(`[command/route.ts] Got stdout (${stdout.length} bytes)`);
      
      console.log(`[command/route.ts] Getting stderr`);
      const stderr = await result.stderr();
      console.log(`[command/route.ts] Got stderr (${stderr.length} bytes)`);
      
      const exitCode = result.exitCode || 0;
      
      // Combine output
      let output = '';
      if (stderr) {
        output += stderr;
      }
      if (stdout) {
        output += stdout;
      }

      console.log(`[command/route.ts] Returning output (${output.length} bytes, exitCode=${exitCode})`);
      return NextResponse.json({
        output: output || '',
        exitCode,
      });
    } catch (error) {
      console.error(`[command/route.ts] Error running command:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({
        output: `Error: ${errorMsg}`,
        exitCode: 1,
      });
    }
  } catch (error) {
    console.error('[command/route.ts] Error executing command:', error);
    return NextResponse.json(
      { error: 'Failed to execute command', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

