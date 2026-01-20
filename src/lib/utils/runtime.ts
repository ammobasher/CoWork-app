/**
 * Runtime Detection Utilities
 *
 * Detect the current runtime environment
 */

export type Runtime = 'nodejs' | 'edge' | 'browser' | 'unknown';

/**
 * Detect the current runtime environment
 */
export function detectRuntime(): Runtime {
  // Check if we're in Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'nodejs';
  }

  // Check if we're in Edge Runtime (Vercel, Cloudflare Workers, etc.)
  if (typeof EdgeRuntime !== 'undefined') {
    return 'edge';
  }

  // Check if we're in a browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  return 'unknown';
}

/**
 * Check if file system operations are available
 */
export function hasFileSystemAccess(): boolean {
  const runtime = detectRuntime();
  return runtime === 'nodejs';
}

/**
 * Check if we're in a server-side context
 */
export function isServerSide(): boolean {
  const runtime = detectRuntime();
  return runtime === 'nodejs' || runtime === 'edge';
}

/**
 * Check if we're in a browser context
 */
export function isBrowser(): boolean {
  return detectRuntime() === 'browser';
}

/**
 * Get a user-friendly runtime name
 */
export function getRuntimeName(): string {
  const runtime = detectRuntime();
  const names: Record<Runtime, string> = {
    nodejs: 'Node.js',
    edge: 'Edge Runtime',
    browser: 'Browser',
    unknown: 'Unknown Runtime',
  };
  return names[runtime];
}
