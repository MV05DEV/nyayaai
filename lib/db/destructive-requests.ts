import { NextRequest } from 'next/server';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalDevelopmentRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    return loopbackHosts.has(originUrl.hostname) && originUrl.origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}
