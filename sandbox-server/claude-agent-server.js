/**
 * Claude Agent Server - Runs inside Vercel Sandbox
 * This server runs Claude Agent SDK with direct access to the sandbox filesystem
 */

const express = require('express');
const { query } = require('@anthropic-ai/claude-agent-sdk');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(express.json());

const PORT = process.env.CLAUDE_PORT || 4000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WORKING_DIR = '/vercel/sandbox';
const LOG_FILE = '/tmp/claude-agent.log';

// Create a write stream for logging
const logStream = fsSync.createWriteStream(LOG_FILE, { flags: 'a' });

// Enhanced logging function that writes to both console and file
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  // Write to console
  console.log(logLine.trim());
  
  // Write to file
  logStream.write(logLine);
}

// Add global error handlers to prevent process crashes
process.on('uncaughtException', (error) => {
  log('ERROR', '🚨 Uncaught Exception:', error.message);
  log('ERROR', 'Stack:', error.stack);
  // Don't exit - allow the server to continue running
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', '🚨 Unhandled Rejection:', reason);
  log('ERROR', 'Promise:', promise);
  // Don't exit - allow the server to continue running
});

// Handle SIGTERM gracefully
process.on('SIGTERM', () => {
  log('INFO', '⚠️ SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

if (!ANTHROPIC_API_KEY) {
  log('ERROR', '❌ ANTHROPIC_API_KEY is not set! Claude Agent SDK will not work.');
  process.exit(1);
}

// Change to the working directory
try {
  process.chdir(WORKING_DIR);
} catch (err) {
  log('ERROR', '❌ Failed to change to working directory:', err.message);
  process.exit(1);
}

log('INFO', '✅ Claude Agent Server starting...');
log('INFO', '✅ ANTHROPIC_API_KEY is set');
log('INFO', '✅ Working Directory:', WORKING_DIR);
log('INFO', '✅ Current Directory:', process.cwd());
log('INFO', '✅ Port:', PORT);
log('INFO', '✅ Log file:', LOG_FILE);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Claude Agent Server is running inside sandbox',
    anthropicKeySet: !!ANTHROPIC_API_KEY,
    logFile: LOG_FILE
  });
});

/**
 * Logs endpoint - stream logs from the log file
 */
app.get('/logs', async (req, res) => {
  try {
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Read existing log content
    try {
      const existingLogs = await fs.readFile(LOG_FILE, 'utf-8');
      const lines = existingLogs.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
      }
    } catch (err) {
      // Log file doesn't exist yet, that's okay
      log('INFO', 'Log file not found, starting fresh');
    }

    // Watch for new log entries (simplified approach - in production use a proper file watcher)
    let lastSize = 0;
    try {
      const stats = await fs.stat(LOG_FILE);
      lastSize = stats.size;
    } catch (err) {
      // File doesn't exist yet
    }

    // Keep connection alive
    const intervalId = setInterval(async () => {
      try {
        const stats = await fs.stat(LOG_FILE);
        if (stats.size > lastSize) {
          // New content available
          const stream = fsSync.createReadStream(LOG_FILE, {
            start: lastSize,
            encoding: 'utf-8'
          });
          
          for await (const chunk of stream) {
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
              res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
            }
          }
          
          lastSize = stats.size;
        }
      } catch (err) {
        // Ignore errors
      }
    }, 1000); // Check every second

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      log('INFO', 'Log stream client disconnected');
    });
  } catch (error) {
    log('ERROR', 'Error streaming logs:', error.message);
    res.status(500).json({ error: 'Failed to stream logs' });
  }
});

/**
 * Chat endpoint - receives user messages and streams Claude responses
 */
app.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  // Get the last user message
  const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
  const promptText = lastUserMessage?.content || '';

  log('INFO', '🤖 [Claude Agent] Received chat request:', promptText);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Create a timeout for the entire request (e.g., 5 minutes)
  const requestTimeoutId = setTimeout(() => {
    log('WARN', '⚠️ [Claude Agent] Request timeout after 5 minutes');
    if (!res.headersSent) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Request timeout - processing took too long' 
      })}\n\n`);
    }
    res.end();
  }, 5 * 60 * 1000); // 5 minutes

  try {
    const systemPrompt = `You are an expert full-stack developer assistant with DIRECT access to the filesystem.
You are running INSIDE the sandbox environment at /vercel/sandbox.

## CRITICAL: File Path Rules
- **ALWAYS use ABSOLUTE PATHS starting with /vercel/sandbox/**
- CORRECT: "/vercel/sandbox/app/page.tsx"
- CORRECT: "/vercel/sandbox/components/ui/button.tsx"
- CORRECT: "/vercel/sandbox/package.json"
- WRONG: "app/page.tsx" (relative paths may not work)
- WRONG: "src/App.tsx" (wrong directory structure)

## Your Capabilities
- Read and write files directly using built-in file tools (Write, Read)
- Search for code patterns using built-in grep/search tools  
- List directory contents using built-in directory tools (ListDir)
- Execute terminal commands using built-in bash tools (Bash)
- Delete files using built-in file tools

## File Operations - IMPORTANT
When using the Write tool:
1. **ALWAYS use absolute paths**: Start with /vercel/sandbox/
2. **The Write tool WILL create parent directories automatically**
3. **Always read existing files first** to understand current structure
4. **Example Write usage**:
   - Path: "/vercel/sandbox/components/Button.tsx"
   - Content: "export function Button() { ... }"

## Guidelines
1. **Use absolute paths**: Every file operation MUST use /vercel/sandbox/[path]
2. **Always read before writing**: Use Read tool to check existing content
3. **Be precise**: Write complete, working code - no placeholders or TODOs
4. **Understand context**: Use ListDir and Grep to understand project structure
5. **Minimal changes**: Only modify what's necessary
6. **Preserve formatting**: Match the existing code style
7. **Test awareness**: Consider how changes affect the rest of the application
8. **Dependencies**: Use Bash tool to install packages if needed
9. **Explain**: Briefly explain what you're doing and why

## Project Structure
This is a Next.js application with the following structure:
- /vercel/sandbox/app/ - Next.js app directory (pages, layouts, etc.)
- /vercel/sandbox/components/ - React components
- /vercel/sandbox/lib/ - Utility functions
- /vercel/sandbox/public/ - Static assets
- /vercel/sandbox/package.json - Dependencies

## Common Tasks
- **Create file**: Use Write with absolute path starting with /vercel/sandbox/
- **Edit file**: Read existing content → Modify → Write back with absolute path
- **Add feature**: ListDir → Read files → Plan → Write files → Bash if needed
- **Fix bug**: Grep → Read → Apply fix → Write
- **Install package**: Use Bash tool with "cd /vercel/sandbox && npm install [package]"

## Example Workflow
User: "Create a Button component"
1. Check structure: ListDir("/vercel/sandbox/components")
2. Write file: Write(path="/vercel/sandbox/components/Button.tsx", content="...")
3. Confirm: "Created Button.tsx at /vercel/sandbox/components/Button.tsx"

You are modifying a live Next.js application running in this sandbox.
The dev server is already running on port 3000.

REMEMBER: ALWAYS USE ABSOLUTE PATHS STARTING WITH /vercel/sandbox/`;

    log('INFO', '🤖 [Claude Agent] Initializing query with built-in tools');

    // Run Claude Agent SDK query with built-in tools
    // Wrap in try-catch to handle any SDK errors
    let agentQuery;
    try {
      agentQuery = query({
        prompt: promptText,
        options: {
          systemPrompt,
          model: 'claude-haiku-4-5-20251001',
          apiKey: ANTHROPIC_API_KEY,
          maxTurns: 15,
          permissionMode: 'bypassPermissions',
        },
      });
    } catch (error) {
      log('ERROR', '❌ [Claude Agent] Failed to initialize query:', error.message);
      throw error;
    }

    log('INFO', '🤖 [Claude Agent] Query initialized, streaming events');

    let eventCount = 0;
    let hasError = false;

    try {
      // Stream the response
      for await (const event of agentQuery) {
        eventCount++;
        
        try {
          if (event.type === 'assistant') {
            const message = event.message;
            
            if (message.content) {
              for (const block of message.content) {
                if (block.type === 'text') {
                  const data = JSON.stringify({
                    type: 'text',
                    content: block.text,
                  });
                  res.write(`data: ${data}\n\n`);
                } else if (block.type === 'tool_use') {
                  log('INFO', '🔧 [Claude Agent] Using tool:', block.name);
                  log('INFO', '🔧 [Claude Agent] Tool input:', JSON.stringify(block.input, null, 2));
                  
                  const data = JSON.stringify({
                    type: 'tool',
                    tool: block.name,
                    input: block.input,
                  });
                  res.write(`data: ${data}\n\n`);
                }
              }
            }
          } else if (event.type === 'tool_result') {
            // Log tool results for debugging
            log('INFO', '✅ [Claude Agent] Tool result:', JSON.stringify(event.result));
            if (event.result.isError) {
              log('ERROR', '❌ [Claude Agent] Tool error:', event.result.content);
            }
          } else if (event.type === 'result') {
            log('INFO', '🤖 [Claude Agent] Result - turns:', event.num_turns, 'cost:', event.total_cost_usd);
          }
        } catch (eventError) {
          log('ERROR', '❌ [Claude Agent] Error processing event:', eventError.message);
          hasError = true;
          break;
        }
      }
    } catch (streamError) {
      log('ERROR', '❌ [Claude Agent] Error in event stream:', streamError.message);
      log('ERROR', '❌ [Claude Agent] Stack trace:', streamError.stack);
      hasError = true;
    }

    log('INFO', '🤖 [Claude Agent] Stream processing complete (events: ' + eventCount + ', hasError: ' + hasError + ')');

    // Send completion event
    if (!hasError) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }
    res.end();
  } catch (error) {
    log('ERROR', '❌ [Claude Agent] Error:', error.message || error);
    log('ERROR', '❌ [Claude Agent] Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (!res.headersSent) {
      const errorData = JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      res.write(`data: ${errorData}\n\n`);
    }
    
    res.end();
  } finally {
    clearTimeout(requestTimeoutId);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler middleware
app.use((err, req, res, next) => {
  log('ERROR', '🚨 Express error:', err.message);
  log('ERROR', 'Stack:', err.stack);
  
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const server = app.listen(PORT, () => {
  log('INFO', `✅ Claude Agent Server running on port ${PORT}`);
  log('INFO', `✅ Ready to receive chat requests`);
  log('INFO', `✅ Logs available at http://localhost:${PORT}/logs`);
});

// Handle server errors
server.on('error', (error) => {
  log('ERROR', '🚨 Server error:', error.message);
  log('ERROR', 'Stack:', error.stack);
  // Try to restart or at least log the error without crashing
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  log('INFO', '⚠️ SIGINT received, shutting down gracefully...');
  server.close(() => {
    log('INFO', '✅ Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    log('ERROR', '❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

