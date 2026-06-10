import { buildSitemapXml } from './_lib/sitemap-build.js';

export const config = { runtime: 'edge' };

export default async function handler() {
    var xml = await buildSitemapXml();
    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60'
        }
    });
}
