import { legacyHtmlResponse } from '../../lib/legacy-html';

export const dynamic = 'force-dynamic';

export async function GET() {
  return legacyHtmlResponse('index.html');
}
