import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LEGACY_ROOT = path.join(process.cwd(), 'legacy');

function isSafeLegacyPath(relativePath) {
  return !relativePath.includes('..') && relativePath.endsWith('.html');
}

export async function legacyHtmlResponse(relativePath) {
  if (!isSafeLegacyPath(relativePath)) {
    return new Response('Not found', { status: 404 });
  }

  const filePath = path.join(LEGACY_ROOT, relativePath);

  try {
    const html = await readFile(filePath, 'utf8');
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
}
