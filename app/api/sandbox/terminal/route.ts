import { NextRequest, NextResponse } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, input } = await request.json();

    if (!sandboxId) {
      return NextResponse.json(
        { error: 'Missing sandboxId' },
        { status: 400 }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // If input is provided, execute the command
    if (input !== undefined && input.trim()) {
      try {
        // Parse command string into cmd and args
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        const process = await sandbox.runCommand({
          cmd,
          args,
          cwd: '/vercel/sandbox',
        });
        
        // Get stdout and stderr separately, then combine
        const stdout = await process.stdout();
        const stderr = await process.stderr();
        const exitCode = process.exitCode || 0;
        
        // Combine output (stderr first if it exists)
        let output = '';
        if (stderr) {
          output += stderr;
        }
        if (stdout) {
          output += stdout;
        }

        return NextResponse.json({ 
          output: output || '',
          exitCode,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ 
          output: `Error: ${errorMsg}\r\n`,
          exitCode: 1,
        });
      }
    }

    return NextResponse.json({ output: '' });
  } catch (error) {
    console.error('Error in terminal:', error);
    return NextResponse.json({ 
      output: 'Failed to process terminal command\r\n',
      exitCode: 1,
    }, { status: 500 });
  }
}

