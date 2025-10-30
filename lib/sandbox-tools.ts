import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sandbox = any;

/**
 * Create MCP server for Vercel Sandbox operations
 * Exposes all file operations through MCP remote protocol to prevent local filesystem access
 * @param sandbox - Vercel Sandbox instance
 */
export function createSandboxMcpServer(sandbox: Sandbox) {
  const read_file = tool(
    'read_file',
    'Read content from a file in the remote Sandbox. Always use this instead of local file access. Returns the complete file content as text.',
    {
      path: z.string().describe('File path relative to project root (e.g., "src/App.tsx")'),
    } as const,
    async ({ path }: { path: string }) => {
      console.log('🔧 [MCP-read_file] Reading from remote Sandbox:', path);
      try {
        console.log('🔧 [MCP-read_file] Calling sandbox.readFile()');
        const stream = await sandbox.readFile({ path });
        if (!stream) {
          throw new Error(`File not found in Sandbox: ${path}`);
        }
        
        // Convert stream to string
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }
        const content = Buffer.concat(chunks).toString('utf-8');
        
        console.log('🔧 [MCP-read_file] ✅ Successfully read from remote Sandbox:', path, 'length:', content.length);
        return {
          content: [{
            type: 'text' as const,
            text: content,
          }],
        };
      } catch (error) {
        const errorMsg = `Failed to read ${path} from Sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-read_file]', errorMsg);
        return {
          content: [{
            type: 'text' as const,
            text: errorMsg,
          }],
          isError: true,
        };
      }
    }
  );

  const write_file = tool(
    'write_file',
    'Write complete file content to a path in the remote Sandbox. Always use this instead of local file writes. Creates directories automatically. Use this to create new files or update existing ones.',
    {
      path: z.string().describe('File path relative to project root (e.g., "src/components/Counter.tsx")'),
      content: z.string().describe('Complete file content to write'),
    } as const,
    async ({ path, content }: { path: string; content: string }) => {
      console.log('🔧 [MCP-write_file] Writing to remote Sandbox:', path, 'length:', content.length, 'bytes');
      
      try {
        // Ensure directory exists
        const dirPath = path.substring(0, path.lastIndexOf('/'));
        if (dirPath) {
          console.log('🔧 [MCP-write_file] Creating directory:', dirPath);
          try {
            await sandbox.mkDir(dirPath);
            console.log('🔧 [MCP-write_file] ✅ Directory created:', dirPath);
          } catch (e) {
            console.log('🔧 [MCP-write_file] ℹ️ Directory exists or error:', dirPath, e instanceof Error ? e.message : 'Unknown error');
          }
        }

        // Convert string to Buffer for writeFiles
        const contentBuffer = Buffer.from(content);
        console.log('🔧 [MCP-write_file] Prepared buffer of', contentBuffer.length, 'bytes');

        // Write the file using writeFiles (accepts array of files with stream property)
        console.log('🔧 [MCP-write_file] Calling sandbox.writeFiles() with stream property...');
        await sandbox.writeFiles([{ 
          path, 
          stream: contentBuffer 
        }]);
        console.log('🔧 [MCP-write_file] ✅ SUCCESS - File written to remote Sandbox:', path, '(' + content.length + ' bytes)');

        return {
          content: [{
            type: 'text' as const,
            text: `✅ SUCCESS: Wrote ${content.length} bytes to ${path} in remote Sandbox.`,
          }],
        };
      } catch (error) {
        const errorMsg = `FAILED to write ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-write_file] ERROR:', errorMsg);
        console.error('❌ [MCP-write_file] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        
        return {
          content: [{
            type: 'text' as const,
            text: `❌ ERROR: ${errorMsg}`,
          }],
          isError: true,
        };
      }
    }
  );

  const list_files = tool(
    'list_files',
    'List files and directories in a path in the remote Sandbox. Useful for understanding project structure. Returns a list of file/directory names.',
    {
      path: z.string().default('.').describe('Directory path relative to project root (e.g., "src/components" or "." for root)'),
    } as const,
    async ({ path }: { path: string }) => {
      console.log('🔧 [MCP-list_files] Listing remote Sandbox directory:', path);
      try {
        // Use ls command to list files
        const result = await sandbox.runCommand({
          cmd: 'ls',
          args: ['-la', path],
        });
        
        const output = await result.stdout();
        const lines = output.split('\n').filter((line: string) => line.trim());
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = [];
        
        for (const line of lines) {
          if (line.startsWith('total') || line.includes('total')) continue;
          
          const parts = line.split(/\s+/);
          if (parts.length < 9) continue;

          const isDirectory = line.startsWith('d');
          const name = parts.slice(8).join(' ');

          if (name === '.' || name === '..') continue;

          items.push({
            name,
            type: isDirectory ? 'directory' : 'file',
          });
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatted = items.map((item: any) => 
          `${item.type === 'directory' ? '📁' : '📄'} ${item.name}`
        ).join('\n');
        
        console.log('🔧 [MCP-list_files] ✅ Found', items.length, 'items in remote Sandbox:', path);
        return {
          content: [{
            type: 'text' as const,
            text: `Files in ${path}:\n${formatted}`,
          }],
        };
      } catch (error) {
        const errorMsg = `Failed to list ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-list_files]', errorMsg);
        return {
          content: [{
            type: 'text' as const,
            text: errorMsg,
          }],
          isError: true,
        };
      }
    }
  );

  const search_files = tool(
    'search_files',
    'Search for a text pattern in files within a directory in the remote Sandbox. Similar to grep. Useful for finding where code is used.',
    {
      pattern: z.string().describe('Text pattern to search for'),
      path: z.string().default('.').describe('Directory path to search in'),
    } as const,
    async ({ pattern, path }: { pattern: string; path: string }) => {
      console.log('🔧 [MCP-search_files] Searching in remote Sandbox for:', pattern, 'in:', path);
      try {
        // Use grep command to search
        const result = await sandbox.runCommand({
          cmd: 'grep',
          args: ['-r', pattern, path],
        });
        
        const output = await result.stdout();
        const lines = output.split('\n').filter((line: string) => line.trim());
        
        if (lines.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No matches found for "${pattern}" in ${path}`,
            }],
          };
        }
        
        console.log('🔧 [MCP-search_files] ✅ Found', lines.length, 'matches in remote Sandbox');
        return {
          content: [{
            type: 'text' as const,
            text: `Found ${lines.length} matches:\n${lines.slice(0, 50).join('\n')}${lines.length > 50 ? '\n... (truncated)' : ''}`,
          }],
        };
      } catch (error) {
        const errorMsg = `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-search_files]', errorMsg);
        return {
          content: [{
            type: 'text' as const,
            text: errorMsg,
          }],
          isError: true,
        };
      }
    }
  );

  const delete_file = tool(
    'delete_file',
    'Delete a file from the remote Sandbox. Use with caution. Always use this instead of local deletion.',
    {
      path: z.string().describe('File path relative to project root to delete'),
    } as const,
    async ({ path }: { path: string }) => {
      console.log('🔧 [MCP-delete_file] Deleting from remote Sandbox:', path);
      try {
        await sandbox.runCommand({
          cmd: 'rm',
          args: ['-rf', path],
        });
        console.log('🔧 [MCP-delete_file] ✅ Deleted from remote Sandbox:', path);
        return {
          content: [{
            type: 'text' as const,
            text: `SUCCESS: Deleted ${path} from remote Sandbox`,
          }],
        };
      } catch (error) {
        const errorMsg = `Failed to delete ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-delete_file]', errorMsg);
        return {
          content: [{
            type: 'text' as const,
            text: errorMsg,
          }],
          isError: true,
        };
      }
    }
  );

  const run_command = tool(
    'run_command',
    'Execute a shell command in the remote Sandbox terminal (e.g., "npm install react-icons", "npm run build"). All commands run in the remote environment, not locally.',
    {
      command: z.string().describe('Shell command to execute'),
    } as const,
    async ({ command }: { command: string }) => {
      console.log('🔧 [MCP-run_command] Running in remote Sandbox:', command);
      try {
        // Parse command string into cmd and args
        const parts = command.split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        const result = await sandbox.runCommand({
          cmd,
          args,
        });
        
        const output = await result.stdout();
        const exitCode = result.exitCode || 0;

        if (exitCode === 0) {
          console.log('🔧 [MCP-run_command] ✅ Success in remote Sandbox:', command);
          return {
            content: [{
              type: 'text' as const,
              text: `Command executed successfully in remote Sandbox:\n${output || 'No output'}`,
            }],
          };
        } else {
          console.log('🔧 [MCP-run_command] ⚠️ Exit code', exitCode);
          return {
            content: [{
              type: 'text' as const,
              text: `Command exited with code ${exitCode} in remote Sandbox:\n${output || 'No output'}`,
            }],
            isError: true,
          };
        }
      } catch (error) {
        const errorMsg = `Command failed in remote Sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ [MCP-run_command]', errorMsg);
        return {
          content: [{
            type: 'text' as const,
            text: errorMsg,
          }],
          isError: true,
        };
      }
    }
  );

  // Create and return the MCP server with proper namespace
  return createSdkMcpServer({
    name: 'sandbox',
    version: '1.0.0',
    tools: [
      read_file,
      write_file,
      list_files,
      search_files,
      delete_file,
      run_command,
    ],
  });
}

