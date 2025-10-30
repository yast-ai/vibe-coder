import { NextResponse } from 'next/server';
import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import { setSandbox, setSandboxStatus } from '@/lib/sandbox-manager';

export async function POST() {
  try {
    console.log('[create/route.ts] Creating Vercel Sandbox...');
    console.log(`[create/route.ts] GitHub Token available: ${!!process.env.GITHUB_TOKEN}`);
    
    const sandbox = await Sandbox.create({
      source: {
        type: 'git',
        url: 'https://github.com/vivek-codepalette/starter-kit-q',
        // username: 'x-access-token',
        // password: process.env.GITHUB_TOKEN || '',
      },
      resources: {
        vcpus: 4,
      },
      timeout: ms('10m'),
      ports: [3000, 4000],
      runtime: 'node22',
    });
    console.log(`[create/route.ts] Sandbox created: ${sandbox.sandboxId}`);

    setSandbox(sandbox.sandboxId, sandbox);
    setSandboxStatus(sandbox.sandboxId, { isReady: false });

    initializeSandbox(sandbox).catch(error => {
      console.error(`[create/route.ts] Error initializing sandbox ${sandbox.sandboxId}:`, error);
      setSandboxStatus(sandbox.sandboxId, { isReady: false, error: error.message });
    });

    const previewUrl = sandbox.domain(3000);
    const claudeServerUrl = sandbox.domain(4000);
    console.log(`[create/route.ts] Preview URL: ${previewUrl}`);
    console.log(`[create/route.ts] Claude Server URL: ${claudeServerUrl}`);

    return NextResponse.json({ 
      sandbox: {
        id: sandbox.sandboxId,
        url: previewUrl,
        claudeUrl: claudeServerUrl,
      }
    });
  } catch (error) {
    console.error('[create/route.ts] Error creating sandbox:', error);
    return NextResponse.json(
      { error: 'Failed to create sandbox', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function initializeSandbox(sandbox: Sandbox) {
  try {
    console.log(`[create/route.ts] Initializing sandbox ${sandbox.sandboxId}...`);
    
    console.log(`[create/route.ts] Installing project dependencies in sandbox ${sandbox.sandboxId}...`);
    const installResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install'],
      cwd: '/vercel/sandbox',
    });
    const installStdout = await installResult.stdout();
    const installStderr = await installResult.stderr();
    console.log(`[create/route.ts] npm install exit code: ${installResult.exitCode}`);
    if (installResult.exitCode !== 0) {
      console.error(`[create/route.ts] npm install failed (stderr):`, installStderr.substring(0, 500));
      throw new Error(`npm install failed with exit code ${installResult.exitCode}`);
    }

    // Copy Claude Agent Server to sandbox
    console.log(`[create/route.ts] Copying Claude Agent Server to sandbox...`);
    const fs = await import('fs');
    const path = await import('path');
    const serverCode = fs.readFileSync(
      path.join(process.cwd(), 'sandbox-server', 'claude-agent-server.js'),
      'utf-8'
    );
    
    await sandbox.writeFiles([{
      path: '/vercel/sandbox/claude-agent-server.js',
      content: Buffer.from(serverCode, 'utf-8'),
    }]);
    console.log(`[create/route.ts] ✅ Claude Agent Server copied to sandbox`);

    console.log(`[create/route.ts] Installing Claude Agent SDK and Express...`);
    const installClaudeResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '@anthropic-ai/claude-agent-sdk', 'express'],
      cwd: '/vercel/sandbox',
    });
    const claudeInstallStdout = await installClaudeResult.stdout();
    const claudeInstallStderr = await installClaudeResult.stderr();
    console.log(`[create/route.ts] Claude SDK install exit code: ${installClaudeResult.exitCode}`);
    if (installClaudeResult.exitCode !== 0) {
      console.error(`[create/route.ts] Claude SDK install failed:`, claudeInstallStderr.substring(0, 500));
      throw new Error(`Failed to install Claude Agent SDK`);
    }
    console.log(`[create/route.ts] ✅ Claude Agent SDK installed`);

    console.log(`[create/route.ts] Starting Claude Agent Server...`);
    await sandbox.runCommand({
      cmd: 'node',
      args: ['claude-agent-server.js'],
      cwd: '/vercel/sandbox',
      detached: true,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        CLAUDE_PORT: '4000',
        NODE_ENV: 'production',
      },
    });
    console.log(`[create/route.ts] ✅ Claude Agent Server started on port 4000`);

    console.log(`[create/route.ts] Waiting for Claude Agent Server to start...`);
    let claudeReady = false;
    let claudeAttempts = 0;
    const maxClaudeAttempts = 30;
    
    while (!claudeReady && claudeAttempts < maxClaudeAttempts) {
      try {
        const healthResult = await sandbox.runCommand({
          cmd: 'curl',
          args: ['-s', 'http://localhost:4000/health'],
          cwd: '/vercel/sandbox',
        });
        const healthOutput = await healthResult.stdout();
        
        if (healthResult.exitCode === 0 && healthOutput.includes('ok')) {
          claudeReady = true;
          console.log(`[create/route.ts] ✅ Claude Agent Server is ready`);
        }
      } catch (error) {
        // Server not ready yet
      }
      
      if (!claudeReady) {
        claudeAttempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!claudeReady) {
      console.warn(`[create/route.ts] ⚠️ Claude Agent Server did not respond within timeout, but proceeding`);
    }

    console.log(`[create/route.ts] Starting dev server in sandbox ${sandbox.sandboxId}...`);
    await sandbox.runCommand({
      cmd: 'npm',
      args: ['run', 'dev'],
      cwd: '/vercel/sandbox',
      detached: true,
    });
    console.log(`[create/route.ts] Dev server command started (detached)`);
    
    console.log(`[create/route.ts] Waiting for dev server to start on port 3000...`);
    let serverReady = false;
    let attempts = 0;
    const maxAttempts = 60;
    const previewUrl = sandbox.domain(3000);
    console.log(`[create/route.ts] Preview URL for health check: ${previewUrl}`);

    while (!serverReady && attempts < maxAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        try {
          console.log(`[create/route.ts] Fetching ${previewUrl} (attempt ${attempts + 1}/${maxAttempts})`);
          const response = await fetch(previewUrl, {
            signal: controller.signal,
            method: 'GET',
          });
          
          clearTimeout(timeoutId);
          console.log(`[create/route.ts] Got response status: ${response.status}`);
          
          if (response.status < 500) {
            serverReady = true;
            console.log(`[create/route.ts] Dev server is responding on port 3000`);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (attempts % 10 === 0 || attempts < 3) {
            console.log(`[create/route.ts] Fetch attempt ${attempts + 1} failed: ${errorMsg}`);
          }
        }
        
        if (!serverReady) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        attempts++;
        console.log(`[create/route.ts] Dev server check attempt ${attempts}/${maxAttempts} failed`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!serverReady) {
      console.warn(`[create/route.ts] Dev server did not start within timeout (${maxAttempts}s), but proceeding anyway`);
    }
    
    console.log(`[create/route.ts] Sandbox ${sandbox.sandboxId} initialized successfully`);
    setSandboxStatus(sandbox.sandboxId, { isReady: true });
  } catch (error) {
    console.error(`[create/route.ts] Error during sandbox initialization:`, error);
    setSandboxStatus(sandbox.sandboxId, { 
      isReady: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}