import { Sandbox } from '@vercel/sandbox';

// Store sandboxes in memory (in production, use a database)
const sandboxes = new Map<string, Sandbox>();

// Store sandbox initialization status
const sandboxStatus = new Map<string, { isReady: boolean; error?: string }>();

/**
 * Get a sandbox by ID
 */
export function getSandbox(id: string): Sandbox | undefined {
  return sandboxes.get(id);
}

/**
 * Store a sandbox instance
 */
export function setSandbox(id: string, sandbox: Sandbox): void {
  sandboxes.set(id, sandbox);
}

/**
 * Check if a sandbox exists
 */
export function hasSandbox(id: string): boolean {
  return sandboxes.has(id);
}

/**
 * Get sandbox status
 */
export function getSandboxStatus(id: string): { isReady: boolean; error?: string } | undefined {
  return sandboxStatus.get(id);
}

/**
 * Set sandbox status
 */
export function setSandboxStatus(id: string, status: { isReady: boolean; error?: string }): void {
  sandboxStatus.set(id, status);
}

/**
 * Get all sandboxes
 */
export function getAllSandboxes(): Map<string, Sandbox> {
  return sandboxes;
}

/**
 * Get all sandbox statuses
 */
export function getAllSandboxStatuses(): Map<string, { isReady: boolean; error?: string }> {
  return sandboxStatus;
}

/**
 * Delete a sandbox
 */
export function deleteSandbox(id: string): boolean {
  sandboxes.delete(id);
  sandboxStatus.delete(id);
  return true;
}
