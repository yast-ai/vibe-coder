import { NextRequest } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    const { sandboxId } = await request.json();

    if (!sandboxId) {
      return new Response(
        JSON.stringify({ error: 'Missing sandboxId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      return new Response(
        JSON.stringify({ error: 'Sandbox not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the Claude Agent Server URL from the sandbox
    const claudeUrl = sandbox.domain(4000);
    if (!claudeUrl) {
      return new Response(
        JSON.stringify({ error: 'Claude Agent Server URL not found' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Connect to Claude Agent Server logs endpoint
    const logsUrl = `${claudeUrl}/logs`;
    console.log('Proxying logs from:', logsUrl);

    const logsResponse = await fetch(logsUrl);

    if (!logsResponse.ok) {
      throw new Error(`Failed to connect to logs: ${logsResponse.statusText}`);
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = logsResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error streaming logs:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in logs endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to stream logs'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

