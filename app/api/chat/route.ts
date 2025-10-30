import { NextRequest } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start processing in the background
  (async () => {
    let timeout: NodeJS.Timeout | null = null;
    
    try {
      const { messages, sandboxId } = await req.json();
      
      if (!messages || !Array.isArray(messages)) {
        throw new Error('Invalid messages format');
      }

      if (!sandboxId) {
        throw new Error('No sandbox ID provided');
      }

      // Get the sandbox from the centralized manager
      const vercelSandbox = getSandbox(sandboxId);
      if (!vercelSandbox) {
        throw new Error(`Sandbox with ID ${sandboxId} not found. This can happen if the function instance was recycled. Make sure to call /api/sandbox/keep-alive periodically to keep the sandbox reference in memory.`);
      }

      console.log('🤖 [Chat API] Streaming from Claude Agent Server inside sandbox...');
      console.log('🤖 [Chat API] User message:', messages[messages.length - 1]?.content);

      // Get the Claude Agent Server URL (exposed on port 4000)
      const claudeServerUrl = vercelSandbox.domain(4000);
      const chatEndpoint = `${claudeServerUrl}/chat`;
      
      console.log('🤖 [Chat API] Fetching from:', chatEndpoint);

      // Create a timeout for the entire request (10 minutes)
      timeout = setTimeout(() => {
        console.error('🚨 [Chat API] Request timeout after 10 minutes');
        writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              message: 'Request timeout - Claude Agent Server took too long to respond',
            })}\n\n`
          )
        ).catch(console.error);
        writer.close().catch(console.error);
      }, 10 * 60 * 1000);

      try {
        // Fetch from the Claude Agent Server with streaming
        const response = await fetch(chatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
          throw new Error(`Claude Agent Server returned ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body from Claude Agent Server');
        }

        console.log('🤖 [Chat API] Streaming response from Claude Agent Server...');

        // Stream the response chunk by chunk
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let totalBytes = 0;

        while (true) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('🤖 [Chat API] ✅ Stream complete (total bytes:', totalBytes, ')');
              break;
            }

            // Decode and forward the chunk immediately
            const chunk = decoder.decode(value, { stream: true });
            totalBytes += value.length;
            await writer.write(encoder.encode(chunk));
          } catch (readError) {
            console.error('❌ [Chat API] Error reading stream:', readError);
            throw readError;
          }
        }
      } catch (fetchError) {
        console.error('❌ [Chat API] Fetch error:', fetchError);
        throw fetchError;
      }

    } catch (error) {
      console.error('❌ [Chat API] Error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error';

      // Format error for the client
      const errorData = JSON.stringify({
        type: 'error',
        message: errorMessage,
        code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
      });

      try {
        await writer.write(encoder.encode(`data: ${errorData}\n\n`));
      } catch (writeError) {
        console.error('❌ [Chat API] Failed to write error to stream:', writeError);
      }
    } finally {
      // Clean up timeout
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // Close the writer
      try {
        await writer.close();
      } catch (closeError) {
        console.error('❌ [Chat API] Error closing stream:', closeError);
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

