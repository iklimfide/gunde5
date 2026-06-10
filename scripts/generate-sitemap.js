/**
 * Build: statik sitemap.xml (yedek) + robots.txt.
 * Canlıda /sitemap.xml → api/sitemap (vercel.json rewrite) dinamik üretir.
 */
const fs = require('fs');
const path = require('path');

async function main() {
    var mod = await import('../api/_lib/sitemap-build.js');
    var xml = await mod.buildSitemapXml();
    var out = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(out, xml, 'utf8');
    var urlSayisi = (xml.match(/<loc>/g) || []).length;
    console.log('sitemap.xml yazildi (' + urlSayisi + ' URL).');
    require('./generate-robots.js');
}

main().catch(function (err) {
    console.error('Sitemap uretimi basarisiz:', err.message || err);
    process.exit(1);
});
