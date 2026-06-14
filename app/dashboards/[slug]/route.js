import { legacyHtmlResponse } from '../../../lib/legacy-html';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { slug } = await params;
  return legacyHtmlResponse(`dashboards/${slug}`);
}
