import { NextRequest, NextResponse } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('[tree/route.ts] POST request received');
    const { sandboxId } = await request.json();
    // console.log(`[tree/route.ts] Request body parsed: sandboxId=${sandboxId}`);

    if (!sandboxId) {
      console.log('[tree/route.ts] Validation failed: missing sandboxId');
      return NextResponse.json(
        { error: 'Missing sandboxId' },
        { status: 400 }
      );
    }

    const sandbox = getSandbox(sandboxId);
    if (!sandbox) {
      console.log(`[tree/route.ts] Sandbox not found: ${sandboxId}`);
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Use ls command to build file tree by parsing output
    async function buildTree(dirPath: string): Promise<FileNode[]> {
      try {
        console.log(`[tree/route.ts] Building tree for: ${dirPath}`);
        
        // Skip .git and node_modules directories entirely
        const dirName = dirPath.split('/').pop();
        if (dirName === '.git' || dirName === 'node_modules' || dirName === '.next' || dirName === 'components/ui') {
          // console.log(`[tree/route.ts] Skipping ignored directory: ${dirPath}`);
          return [];
        }
        
        // Run ls -la to get directory listing using the params object format
        // sandbox is guaranteed to exist due to check above
        const process = await sandbox!.runCommand({
          cmd: 'ls',
          args: ['-la', dirPath],
        });
        
        // Get output from the command (stdout/stderr are async methods)
        // console.log(`[tree/route.ts] Getting stdout for: ${dirPath}`);
        const output = await process.stdout();
        // console.log(`[tree/route.ts] Got stdout for: ${dirPath} (${output.length} bytes)`);

        const lines = output.split('\n').filter(line => line.trim());
        // console.log(`[tree/route.ts] Parsed ${lines.length} lines for: ${dirPath}`);
        const nodes: FileNode[] = [];

        // Parse ls -la output
        // Format: drwxr-xr-x  5 user  group  160 Oct 28 12:34 dirname
        //         -rw-r--r--  1 user  group 1024 Oct 28 12:34 filename
        for (const line of lines) {
          // Skip the "total" line and header
          if (line.startsWith('total') || line.includes('total')) continue;
          
          // Parse the ls output
          const parts = line.split(/\s+/);
          if (parts.length < 9) continue;

          const isDirectory = line.startsWith('d');
          const name = parts.slice(8).join(' '); // Handle names with spaces

          // Skip . and ..
          if (name === '.' || name === '..') continue;
          
          // Skip .git and node_modules
          if (name === '.git' || name === 'node_modules') {
            // console.log(`[tree/route.ts] Skipping ignored item: ${name}`);
            continue;
          }

          const fullPath = dirPath === '.' ? name : `${dirPath}/${name}`;

          const node: FileNode = {
            name,
            path: fullPath,
            type: isDirectory ? 'directory' : 'file',
          };

          if (isDirectory) {
            // Recursively get children
            // console.log(`[tree/route.ts] Recursing into directory: ${fullPath}`);
            node.children = await buildTree(fullPath);
          }

          nodes.push(node);
        }

        // console.log(`[tree/route.ts] Completed tree for: ${dirPath} (${nodes.length} nodes)`);
        return nodes;
      } catch (error) {
        console.error(`[tree/route.ts] Error building tree for ${dirPath}:`, error);
        return [];
      }
    }

    // console.log(`[tree/route.ts] Starting to build file tree`);
    const tree = await buildTree('.');
    // console.log(`[tree/route.ts] File tree built successfully (${tree.length} root nodes)`);

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('[tree/route.ts] Error building file tree:', error);
    return NextResponse.json(
      { error: 'Failed to build file tree', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

